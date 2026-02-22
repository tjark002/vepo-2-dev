import db from "../db.server";

// ============================================================================
// Rate Limiter & Cache
// ============================================================================

function createRateLimiter(requestsPerSecond = 2) {
  const queue = [];
  let processing = false;

  async function processQueue() {
    if (processing || queue.length === 0) return;
    processing = true;
    const item = queue.shift();

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      processing = false;
      setTimeout(() => processQueue(), 1000 / requestsPerSecond);
    }
  }

  return function enqueue(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      if (!processing) processQueue();
    });
  };
}

const vepoRateLimiter = createRateLimiter(2);

const vepoProductCache = new Map();
const VEPO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function vepoClearExpiredCache() {
  const now = Date.now();
  for (const [key, { timestamp }] of vepoProductCache.entries()) {
    if (now - timestamp > VEPO_CACHE_TTL) {
      vepoProductCache.delete(key);
    }
  }
}

setInterval(vepoClearExpiredCache, 60 * 1000);

// ============================================================================
// GraphQL Helpers
// ============================================================================

async function vepoGraphqlWithRetry(graphql, query, variables, maxRetries = 3) {
  let retries = 0;

  while (true) {
    try {
      return await graphql(query, variables);
    } catch (error) {
      if (
        error.message &&
        error.message.includes("Throttled") &&
        retries < maxRetries
      ) {
        const waitTime = Math.pow(2, retries) * 1000;
        console.log(
          `[Vepo] API throttled, retrying in ${waitTime}ms (attempt ${retries + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }
      throw error;
    }
  }
}

// ============================================================================
// Safe JSON parse helper
// ============================================================================

function vepoSafeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.error("[Vepo] JSON parse error:", error.message, "Input:", str?.substring?.(0, 100));
    return fallback;
  }
}

// ============================================================================
// Product Configuration Queries
// ============================================================================

export async function vepoGetConfigByProductId(productId, graphql) {
  try {
    const configurableProduct = await db.configurableProduct.findFirst({
      where: { productId },
      include: {
        ProductConfigurationOptions: {
          include: { options: true },
        },
      },
    });

    if (!configurableProduct) return null;

    return vepoSupplementProductConfig(configurableProduct, graphql);
  } catch (error) {
    console.error("[Vepo] Error getting config by product ID:", error);
    return null;
  }
}

export async function vepoGetConfiguration(id, graphql) {
  try {
    const productConfig = await db.productConfigurationOptions.findUnique({
      where: { id },
      include: {
        options: true,
        virtualVariants: true,
        rules: {
          include: {
            targetOption: true,
            conditions: {
              include: { option: true },
            },
          },
        },
      },
    });

    if (!productConfig) return null;

    // Parse option values JSON safely
    productConfig.options = productConfig.options.map((option) => ({
      ...option,
      values: option.values ? vepoSafeJsonParse(option.values, []) : [],
    }));

    // Format rules for frontend consumption (same as vepoGetConfigurations)
    // The frontend expects: { targetOptionId, targetValueId, show, priority, conditions: [{ optionId, operator, value }] }
    productConfig.rules = (productConfig.rules || [])
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .map((rule) => ({
        id: rule.id,
        targetOptionId: rule.targetOptionId,
        targetValueId: rule.targetValueId || null,
        show: rule.show,
        priority: rule.priority || 0,
        conditions: (rule.conditions || []).map((cond) => ({
          id: cond.id,
          optionId: cond.optionId,
          operator: cond.operator,
          value: cond.value,
        })),
      }));

    // Fetch configurable products
    productConfig.configurableProducts = await db.configurableProduct.findMany({
      where: { optionsId: productConfig.id },
    });

    // Supplement each product sequentially to avoid throttling
    const supplemented = [];
    for (const cp of productConfig.configurableProducts) {
      supplemented.push(await vepoSupplementProductConfig(cp, graphql));
    }
    productConfig.configurableProducts = supplemented;

    return productConfig;
  } catch (error) {
    console.error("[Vepo] Error getting configuration:", error);
    return null;
  }
}

export async function vepoGetConfigurations(shopDomain, graphql, skipSupplementing = false) {
  try {
    const productConfigs = await db.productConfigurationOptions.findMany({
      where: { shop: shopDomain },
      include: {
        options: true,
        virtualVariants: true,
        rules: {
          include: {
            targetOption: true,
            conditions: {
              include: { option: true },
            },
          },
        },
      },
    });

    if (productConfigs.length === 0) return [];

    const response = [];
    for (const productConfig of productConfigs) {
      // Parse option values JSON safely (same as vepoGetConfiguration singular)
      productConfig.options = productConfig.options.map((option) => ({
        ...option,
        values: option.values ? vepoSafeJsonParse(option.values, []) : [],
      }));

      // Format rules for frontend consumption
      // The frontend expects: { targetOptionId, targetValueId, show, priority, conditions: [{ optionId, operator, value }] }
      productConfig.rules = (productConfig.rules || [])
        .sort((a, b) => (a.priority || 0) - (b.priority || 0))
        .map((rule) => ({
          id: rule.id,
          targetOptionId: rule.targetOptionId,
          targetValueId: rule.targetValueId || null,
          show: rule.show,
          priority: rule.priority || 0,
          conditions: (rule.conditions || []).map((cond) => ({
            id: cond.id,
            optionId: cond.optionId,
            operator: cond.operator,
            value: cond.value,
          })),
        }));

      const configurableProducts = await db.configurableProduct.findMany({
        where: { optionsId: productConfig.id },
      });

      if (skipSupplementing) {
        productConfig.configurableProducts = configurableProducts.map((p) => ({
          ...p,
          productTitle: "Laden...",
          productImage: null,
          productDeleted: false,
          productAlt: null,
        }));
      } else {
        const supplemented = [];
        for (const cp of configurableProducts) {
          supplemented.push(await vepoSupplementProductConfig(cp, graphql));
        }
        productConfig.configurableProducts = supplemented;
      }

      response.push(productConfig);
    }

    return response;
  } catch (error) {
    console.error("[Vepo] Error getting configurations:", error);
    return [];
  }
}

// ============================================================================
// Supplement product with Shopify data (cached + rate-limited)
// ============================================================================

async function vepoSupplementProductConfig(productConfig, graphql) {
  const cacheKey = productConfig.productId;
  if (vepoProductCache.has(cacheKey)) {
    const { data, timestamp } = vepoProductCache.get(cacheKey);
    if (Date.now() - timestamp < VEPO_CACHE_TTL) {
      return { ...productConfig, ...data };
    }
  }

  return vepoRateLimiter(async () => {
    try {
      const response = await vepoGraphqlWithRetry(
        graphql,
        `
          query vepoSupplementProduct($id: ID!) {
            product(id: $id) {
              title
              images(first: 1) {
                nodes {
                  altText
                  url
                }
              }
            }
          }
        `,
        { variables: { id: productConfig.productId } }
      );

      const {
        data: { product },
      } = await response.json();

      const productData = {
        productDeleted: !product?.title,
        productTitle: product?.title,
        productImage: product?.images?.nodes[0]?.url,
        productAlt: product?.images?.nodes[0]?.altText,
      };

      vepoProductCache.set(cacheKey, {
        data: productData,
        timestamp: Date.now(),
      });

      return { ...productConfig, ...productData };
    } catch (error) {
      console.error(`[Vepo] Error fetching product ${productConfig.productId}:`, error);
      return {
        ...productConfig,
        productDeleted: true,
        productTitle: "Fehler beim Laden",
        productImage: null,
        productAlt: null,
      };
    }
  });
}

// ============================================================================
// Validation
// ============================================================================

export async function vepoValidateProductConfig(data, dataId) {
  const errors = {};

  if (!data.title) {
    errors.title = "Titel ist erforderlich";
  }

  let configurableProducts = [];
  try {
    if (data.configurableProducts === "undefined" || !data.configurableProducts) {
      configurableProducts = [];
    } else if (typeof data.configurableProducts === "string") {
      configurableProducts = JSON.parse(data.configurableProducts);
    } else if (Array.isArray(data.configurableProducts)) {
      configurableProducts = data.configurableProducts;
    } else {
      throw new Error("Invalid format");
    }
  } catch (error) {
    errors.configurableProducts = "Ungültiges Produktformat";
    return { errors, existingConfigId: null };
  }

  // Check if any product is already assigned to a different configuration
  // When dataId is null (new config), detect if products belong to the same
  // existing config (e.g. from a previous partial save or auto-save).
  let detectedConfigId = null;

  for (const cp of configurableProducts) {
    const existing = await db.configurableProduct.findFirst({
      where: { productId: cp.productId },
    });

    if (existing) {
      if (dataId && existing.optionsId !== dataId) {
        errors.dataId = "Produkt ist bereits einem anderen Konfigurator zugeordnet";
      } else if (!dataId) {
        // No dataId (new config) – check if all assigned products belong to the same config
        if (detectedConfigId === null) {
          detectedConfigId = existing.optionsId;
        } else if (detectedConfigId !== existing.optionsId) {
          // Products belong to different configs – this is a real conflict
          errors.dataId = "Produkt ist bereits einem Konfigurator zugeordnet";
          detectedConfigId = null;
        }
        // If all products share the same config, it's likely a re-save – no error
      }
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  return {
    errors: hasErrors ? errors : null,
    existingConfigId: !dataId && !hasErrors ? detectedConfigId : null,
  };
}

// ============================================================================
// Variant Creation (Add to Cart Flow)
// ============================================================================

export async function vepoConfigureProduct(
  originalProduct,
  configString,
  price,
  priceFormula,
  graphql,
  session,
  admin,
  priceMode,
  title = "",
  weight = null,
  sku = null
) {
  try {
    let productVariantTitle = title || "";

    if (productVariantTitle === "") {
      if (priceMode === "price-formula") {
        productVariantTitle = vepoGenerateProductTitle(
          originalProduct.productTitle,
          configString,
          priceFormula,
          price
        );
      } else {
        // variant-price or info-only mode: build title from selected options
        const configData = vepoSafeJsonParse(configString, []);
        const handle = Array.isArray(configData)
          ? configData.map((c) => c.values || c.name).join(" / ")
          : (configData.variantHandle || "");
        productVariantTitle = handle + "-" + price;
        // price is already passed correctly from the client (includes surcharges)
      }
    }

    const weightValue = weight !== null ? parseFloat(weight) : null;

    return await vepoCreateOrUpdateVariant(
      originalProduct.productId,
      productVariantTitle,
      price,
      graphql,
      session,
      admin,
      weightValue,
      sku
    );
  } catch (error) {
    console.error("[Vepo] Error in vepoConfigureProduct:", error);
    return { productVariantID: null, variantAlreadyExists: false };
  }
}

async function vepoCreateOrUpdateVariant(
  productId,
  productVariantTitle,
  productPrice,
  graphql,
  session,
  admin,
  weightValue = null,
  sku = null
) {
  if (!productVariantTitle) {
    throw new Error("Product variant title is required");
  }

  const productVariants = await vepoGetProductVariants(productId, graphql);
  const sortedByTimestamp = vepoSortVariantsByTimestamp(productVariants);

  // Check if variant with this title already exists
  const existingVariantId = vepoFindVariantByTitle(productVariantTitle, productVariants);

  if (existingVariantId) {
    const existingVariant = productVariants.find((v) => v.node.id === existingVariantId);
    // Compare prices as floats to avoid false mismatch ("719.00" vs "719")
    const existingPrice = parseFloat(existingVariant?.node.price || 0);
    const requestedPrice = parseFloat(productPrice || 0);
    const priceChanged = Math.abs(existingPrice - requestedPrice) > 0.001;

    if (priceChanged) {
      console.log("[Vepo] Price changed:", existingPrice, "→", requestedPrice, "- updating variant");
      await vepoUpdateVariant(existingVariantId, productPrice, productVariantTitle, graphql, weightValue, sku, productId);
      return { productVariantID: existingVariantId, variantAlreadyExists: true, variantWasUpdated: true };
    }
    return { productVariantID: existingVariantId, variantAlreadyExists: true, variantWasUpdated: false };
  }

  // If at limit, update the 3rd oldest variant
  if (productVariants.length >= 10) {
    const variantToUpdate = sortedByTimestamp[2]?.node?.id;
    if (variantToUpdate) {
      const updateResponse = await vepoUpdateVariant(
        variantToUpdate, productPrice, productVariantTitle, graphql, weightValue, sku, productId
      );
      return { productVariantID: updateResponse?.productVariantID, variantAlreadyExists: false, variantWasUpdated: true };
    }
  }

  // Create new variant
  const response = await vepoCreateVariant(productId, productPrice, productVariantTitle, graphql, weightValue, sku);
  if (!response) return { productVariantID: null, variantAlreadyExists: false, variantWasUpdated: false };

  const responseData = await response.json();
  const { data: { productVariantsBulkCreate: { productVariants: createdVariants, userErrors } } } = responseData;

  if (userErrors?.length > 0) {
    console.error("[Vepo] Errors creating variant:", userErrors);
    return { productVariantID: null, variantAlreadyExists: false };
  }

  const created = createdVariants?.[0];
  if (created?.id) {
    // Disable inventory tracking on the new variant so it's always sellable.
    // productVariantsBulkCreate doesn't reliably apply inventoryPolicy/tracked settings.
    try {
      // First get the inventory item ID for this variant
      const variantQuery = await graphql(
        `query vepoGetNewVariant($id: ID!) {
          productVariant(id: $id) {
            inventoryItem { id tracked }
          }
        }`,
        { variables: { id: created.id } }
      );
      const variantData = await variantQuery.json();
      const inventoryItemId = variantData.data?.productVariant?.inventoryItem?.id;

      if (inventoryItemId) {
        await graphql(
          `mutation vepoFixNewVariantTracking($id: ID!, $input: InventoryItemInput!) {
            inventoryItemUpdate(id: $id, input: $input) {
              inventoryItem { id tracked }
              userErrors { field message }
            }
          }`,
          { variables: { id: inventoryItemId, input: { tracked: false } } }
        );
        console.log("[Vepo] Disabled tracking for new variant:", created.id);
      }
    } catch (e) {
      console.error("[Vepo] Error fixing new variant tracking:", e);
    }
  }
  return { productVariantID: created?.id, variantAlreadyExists: false, variantWasUpdated: true };
}

// ============================================================================
// Variant CRUD helpers
// ============================================================================

async function vepoCreateVariant(productId, price, title, graphql, weightValue = null, sku = null) {
  try {
    const inventoryItem = {
      tracked: false,
      requiresShipping: true,
    };

    if (weightValue !== null) {
      inventoryItem.measurement = {
        weight: { value: weightValue, unit: "KILOGRAMS" },
      };
    }

    if (sku !== null) {
      inventoryItem.sku = sku;
    }

    return await graphql(
      `
        mutation vepoCreateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          productId,
          variants: [
            {
              price,
              inventoryPolicy: "CONTINUE",
              inventoryItem,
              optionValues: [{ optionName: "Title", name: title }],
              metafields: [
                {
                  namespace: "vepo",
                  key: "timestamp",
                  type: "single_line_text_field",
                  value: Date.now().toString(),
                },
              ],
            },
          ],
        },
      }
    );
  } catch (error) {
    console.error("[Vepo] Error creating variant:", error);
    return null;
  }
}

async function vepoUpdateVariant(variantId, price, title, graphql, weightValue = null, sku = null, productId = null) {
  try {
    // Get existing metafield ID for timestamp
    const metafieldResponse = await graphql(
      `
        query vepoGetVariantMetafields($id: ID!) {
          productVariant(id: $id) {
            metafields(first: 10) {
              edges {
                node { id, key, value, namespace }
              }
            }
          }
        }
      `,
      { variables: { id: variantId } }
    );

    const metafields = await metafieldResponse.json();
    const timestampMetafield = metafields.data.productVariant.metafields.edges.find(
      (mf) => mf.node.key === "timestamp" && mf.node.namespace === "vepo"
    );

    const metafieldData = timestampMetafield
      ? { id: timestampMetafield.node.id, value: Date.now().toString() }
      : { namespace: "vepo", key: "timestamp", type: "single_line_text_field", value: Date.now().toString() };

    const inventoryItem = { tracked: false, requiresShipping: true };
    if (weightValue !== null) {
      inventoryItem.measurement = { weight: { value: weightValue, unit: "KILOGRAMS" } };
    }
    if (sku !== null) {
      inventoryItem.sku = sku;
    }

    const response = await graphql(
      `
        mutation vepoUpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              message
              field
            }
          }
        }
      `,
      {
        variables: {
          productId,
          variants: [
            {
              id: variantId,
              price,
              optionValues: [{ optionName: "Title", name: title }],
              metafields: [metafieldData],
              inventoryItem,
            },
          ],
        },
      }
    );

    const responseData = await response.json();
    const { data: { productVariantsBulkUpdate: { productVariants: updated, userErrors } } } = responseData;

    if (userErrors?.length > 0) {
      console.error("[Vepo] Errors updating variant:", userErrors);
      return { productVariantID: null };
    }

    return { productVariantID: updated?.[0]?.id };
  } catch (error) {
    console.error("[Vepo] Error updating variant:", error);
    return { productVariantID: null };
  }
}

async function vepoDeleteVariant(variantId, graphql, productId) {
  try {
    return await graphql(
      `
        mutation vepoDeleteVariants($productId: ID!, $variantIds: [ID!]!) {
          productVariantsBulkDelete(productId: $productId, variantIds: $variantIds) {
            product { id }
            userErrors { field, message }
          }
        }
      `,
      { variables: { productId, variantIds: [variantId] } }
    );
  } catch (error) {
    console.error("[Vepo] Error deleting variant:", error);
    return null;
  }
}

async function vepoGetProductVariants(productId, graphql) {
  try {
    const response = await graphql(
      `
        query vepoGetVariants($id: ID!) {
          product(id: $id) {
            variants(first: 250) {
              edges {
                node {
                  id
                  title
                  price
                  inventoryItem {
                    id
                    tracked
                    sku
                    requiresShipping
                    measurement { weight { value, unit } }
                  }
                  metafields(first: 10) {
                    edges {
                      node { id, key, value, namespace }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { variables: { id: productId } }
    );

    const responseData = await response.json();
    return responseData?.data?.product?.variants?.edges || [];
  } catch (error) {
    console.error("[Vepo] Error getting product variants:", error);
    return [];
  }
}

function vepoFindVariantByTitle(title, variants) {
  for (const variant of variants) {
    if (variant.node.title === title) {
      return variant.node.id;
    }
  }
  return null;
}

function vepoSortVariantsByTimestamp(variants) {
  return variants
    .filter((v) =>
      v.node.metafields.edges.some(
        (mf) => mf.node.key === "timestamp" && mf.node.namespace === "vepo"
      )
    )
    .sort((a, b) => {
      const aTs = a.node.metafields.edges.find((mf) => mf.node.key === "timestamp")?.node.value || "0";
      const bTs = b.node.metafields.edges.find((mf) => mf.node.key === "timestamp")?.node.value || "0";
      return parseInt(aTs) - parseInt(bTs);
    });
}

// ============================================================================
// Price Calculation
// ============================================================================

export function vepoCalculatePrice(priceFormula, options) {
  let formula = priceFormula;

  for (const option of options) {
    formula = formula.replace(
      new RegExp("\\[" + option.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g"),
      option.values !== "" ? option.values : "0"
    );
  }

  // If there are still unresolved variables, return 0
  if (formula.includes("[") || formula.includes("]")) {
    return 0;
  }

  formula = vepoPrepareFormula(formula);

  try {
    // Safe eval using Function constructor (no access to scope)
    const result = new Function(`"use strict"; return (${formula})`)();
    if (isNaN(result) || !isFinite(result)) return 0;
    return Math.round(result * 100) / 100;
  } catch (error) {
    console.error("[Vepo] Formula evaluation error:", error.message, "Formula:", formula);
    return 0;
  }
}

function vepoPrepareFormula(formula) {
  formula = formula.trim();
  formula = formula.replace(/,/g, ".");
  formula = formula.replace(/\.{2,}/g, ".");
  formula = formula.replace(/^\./, "0.");
  formula = formula.replace(/x/gi, "*");
  formula = formula.replace(/÷/g, "/");
  formula = formula.replace(/%/g, "/100");
  // Validate: only allow numbers, operators, parentheses, dots, spaces
  formula = formula.replace(/[^0-9+\-*/().  ]/g, "");
  return formula;
}

function vepoGenerateProductTitle(productTitle, configString, priceFormula, price) {
  let config;
  try {
    config = JSON.parse(configString);
  } catch {
    return productTitle + "-" + price;
  }

  if (!Array.isArray(config) || config.length === 0) {
    return productTitle + "-" + price;
  }

  return productTitle + "-" + price;
}

// ============================================================================
// Bulk Variant Creation
// ============================================================================

export async function vepoCreateBulkVariants(configurableProducts, graphql, useUnifiedSku = false, unifiedSku = null) {
  try {
    for (const cp of configurableProducts) {
      await vepoCreateVariantsForProduct(cp.productId, graphql, useUnifiedSku, unifiedSku);
    }
    return true;
  } catch (error) {
    console.error("[Vepo] Error creating bulk variants:", error);
    return false;
  }
}

async function vepoCreateVariantsForProduct(productId, graphql, useUnifiedSku = false, unifiedSku = null) {
  const productTitle = await vepoGetProductTitle(productId, graphql);
  const productVariants = await vepoGetProductVariants(productId, graphql);
  const variantsToCreate = 100 - productVariants.length;

  if (variantsToCreate <= 0) return;

  const variantsInput = [];
  for (let i = 0; i < variantsToCreate; i++) {
    const input = {
      price: (100 + i).toString(),
      inventoryPolicy: "CONTINUE",
      inventoryItem: {
        tracked: false,
        requiresShipping: true,
      },
      optionValues: [
        { optionName: "Title", name: productTitle + Math.random().toString(36).substring(7) },
      ],
      metafields: [
        {
          namespace: "vepo",
          key: "timestamp",
          type: "single_line_text_field",
          value: Date.now().toString(),
        },
      ],
    };

    if (useUnifiedSku && unifiedSku) {
      input.inventoryItem.sku = unifiedSku;
    }

    variantsInput.push(input);
  }

  const response = await graphql(
    `
      mutation vepoCreateBulkVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field, message }
        }
      }
    `,
    { variables: { productId, variants: variantsInput } }
  );

  const data = await response.json();
  if (data.data?.productVariantsBulkCreate?.userErrors?.length > 0) {
    console.error("[Vepo] Bulk variant creation errors:", data.data.productVariantsBulkCreate.userErrors);
  }
}

export async function vepoCreateBulkVirtualVariants(configurableProducts, virtualVariants, graphql) {
  try {
    for (const cp of configurableProducts) {
      await vepoDeleteOptionsFromProduct(cp.productId, graphql);
      await vepoCreateVirtualVariantsForProduct(cp.productId, virtualVariants, graphql);
    }
    return true;
  } catch (error) {
    console.error("[Vepo] Error creating bulk virtual variants:", error);
    return false;
  }
}

async function vepoDeleteOptionsFromProduct(productId, graphql) {
  try {
    const response = await graphql(
      `
        query vepoGetProductOptions($id: ID!) {
          product(id: $id) {
            options(first: 3) {
              id
              name
              optionValues { id }
            }
          }
        }
      `,
      { variables: { id: productId } }
    );

    const { data: { product } } = await response.json();
    const options = product.options;

    if (options.length > 1 || options[0].name !== "Title") {
      await graphql(
        `
          mutation vepoDeleteOptions($productId: ID!, $options: [ID!]!, $strategy: ProductOptionDeleteStrategy) {
            productOptionsDelete(productId: $productId, options: $options, strategy: $strategy) {
              userErrors { field, message, code }
              deletedOptionsIds
            }
          }
        `,
        {
          variables: {
            productId,
            options: options.map((o) => o.id),
            strategy: "POSITION",
          },
        }
      );
    }
  } catch (error) {
    console.error("[Vepo] Error deleting product options:", error);
  }
}

async function vepoCreateVirtualVariantsForProduct(productId, virtualVariants, graphql) {
  const productTitle = await vepoGetProductTitle(productId, graphql);
  const productVariants = await vepoGetProductVariants(productId, graphql);
  const maxVariants = Math.min(virtualVariants.length, 100);
  const variantsToCreate = maxVariants - productVariants.length;

  if (variantsToCreate <= 0) return;

  virtualVariants.sort((a, b) => Number(a.variantPrice) - Number(b.variantPrice));

  const variantsInput = [];
  for (let i = 0; i < variantsToCreate; i++) {
    if (!virtualVariants[i]) break;
    variantsInput.push({
      price: virtualVariants[i].variantPrice.toString(),
      inventoryPolicy: "CONTINUE",
      inventoryItem: { tracked: false, requiresShipping: true },
      optionValues: [
        {
          optionName: "Title",
          name: virtualVariants[i].variantHandle + "-" + Number(virtualVariants[i].variantPrice),
        },
      ],
      metafields: [
        {
          namespace: "vepo",
          key: "timestamp",
          type: "single_line_text_field",
          value: Date.now().toString(),
        },
      ],
    });
  }

  if (variantsInput.length === 0) return;

  const response = await graphql(
    `
      mutation vepoCreateVirtualVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { id }
          userErrors { field, message }
        }
      }
    `,
    { variables: { productId, variants: variantsInput } }
  );

  const data = await response.json();
  if (data.data?.productVariantsBulkCreate?.userErrors?.length > 0) {
    console.error("[Vepo] Virtual variant creation errors:", data.data.productVariantsBulkCreate.userErrors);
  }
}

// ============================================================================
// Product Helpers
// ============================================================================

async function vepoGetProductTitle(productId, graphql) {
  try {
    const response = await graphql(
      `query vepoGetTitle($id: ID!) { product(id: $id) { title } }`,
      { variables: { id: productId } }
    );
    const { data: { product } } = await response.json();
    return product?.title || "Untitled";
  } catch (error) {
    console.error("[Vepo] Error getting product title:", error);
    return "Untitled";
  }
}

export async function vepoGetProductVariantById(id, graphql) {
  try {
    const response = await graphql(
      `
        query vepoGetVariant($id: ID!) {
          productVariant(id: $id) {
            id, title, price
            product { id }
          }
        }
      `,
      { variables: { id } }
    );
    const { data: { productVariant } } = await response.json();
    return productVariant;
  } catch (error) {
    console.error("[Vepo] Error getting variant by ID:", error);
    return null;
  }
}

// ============================================================================
// Publishing & Tags
// ============================================================================

export async function vepoPublishProduct(productID, graphql) {
  try {
    const publicationId = await vepoGetOnlineStorePublicationId(graphql);
    if (!publicationId) return false;

    await graphql(
      `
        mutation vepoPublish($id: ID!, $input: [PublicationInput!]!) {
          publishablePublish(id: $id, input: $input) {
            publishable { availablePublicationsCount { count } }
          }
        }
      `,
      { variables: { id: productID, input: { publicationId } } }
    );
    return true;
  } catch (error) {
    console.error("[Vepo] Error publishing product:", error);
    return false;
  }
}

async function vepoGetOnlineStorePublicationId(graphql) {
  try {
    const response = await graphql(
      `query vepoGetPublications { publications(first: 10) { edges { node { id, name } } } }`
    );
    const { data: { publications } } = await response.json();

    for (const pub of publications.edges) {
      if (pub.node.name === "Online Store" || pub.node.name === "Onlineshop") {
        return pub.node.id;
      }
    }
    return null;
  } catch (error) {
    console.error("[Vepo] Error getting publication ID:", error);
    return null;
  }
}

export async function vepoAddTagsToProduct(productId, graphql, tags) {
  try {
    await graphql(
      `mutation vepoAddTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } } }`,
      { variables: { id: productId, tags } }
    );
  } catch (error) {
    console.error("[Vepo] Error adding tags:", error);
  }
}

export async function vepoRemoveTagsFromProduct(productId, graphql, tags) {
  try {
    const tagsArray = Array.isArray(tags) ? tags : tags.split(",").map((t) => t.trim());
    await graphql(
      `mutation vepoRemoveTags($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { node { id } } }`,
      { variables: { id: productId, tags: tagsArray } }
    );
  } catch (error) {
    console.error("[Vepo] Error removing tags:", error);
  }
}

// ============================================================================
// Delete Configuration
// ============================================================================

export async function vepoDeleteConfiguration(configId, configTitle, graphql) {
  try {
    // Remove tags from products
    const configurableProducts = await db.configurableProduct.findMany({
      where: { optionsId: configId },
    });

    const tags = ["vepo-configurator"];
    if (configTitle) {
      tags.push(configTitle.toLowerCase().replace(/ /g, "-"));
    }

    for (const product of configurableProducts) {
      await vepoRemoveTagsFromProduct(product.productId, graphql, tags);
    }

    // Delete in correct order (foreign key constraints)
    const rules = await db.optionRule.findMany({ where: { configurationId: configId } });

    for (const rule of rules) {
      await db.condition.deleteMany({ where: { ruleId: rule.id } });
    }

    await db.optionRule.deleteMany({ where: { configurationId: configId } });
    await db.virtualProductVariant.deleteMany({ where: { configurationId: configId } });
    await db.configurableProduct.deleteMany({ where: { optionsId: configId } });

    // Find options linked to this configuration
    const optionsToDelete = await db.option.findMany({
      where: { productConfigurations: { some: { id: configId } } },
      select: { id: true },
    });
    const optionIds = optionsToDelete.map(o => o.id);

    if (optionIds.length > 0) {
      // Delete OptionRules (from any config) that reference these options as targetOption
      const rulesReferencingOptions = await db.optionRule.findMany({
        where: { targetOptionId: { in: optionIds } },
      });
      for (const rule of rulesReferencingOptions) {
        await db.condition.deleteMany({ where: { ruleId: rule.id } });
      }
      await db.optionRule.deleteMany({ where: { targetOptionId: { in: optionIds } } });

      // Delete conditions that reference these options, and orphaned rules
      const conditionsUsingOptions = await db.condition.findMany({
        where: { optionId: { in: optionIds } },
        select: { id: true, ruleId: true },
      });
      const affectedRuleIds = [...new Set(conditionsUsingOptions.map(c => c.ruleId))];
      await db.condition.deleteMany({ where: { optionId: { in: optionIds } } });

      // Delete rules that have no remaining conditions
      for (const ruleId of affectedRuleIds) {
        const remainingConditions = await db.condition.count({ where: { ruleId } });
        if (remainingConditions === 0) {
          await db.optionRule.delete({ where: { id: ruleId } });
        }
      }
    }

    // Delete options linked to this configuration
    await db.option.deleteMany({
      where: { productConfigurations: { some: { id: configId } } },
    });

    await db.productConfigurationOptions.delete({ where: { id: configId } });

    return true;
  } catch (error) {
    console.error("[Vepo] Error deleting configuration:", error);
    return false;
  }
}

// ============================================================================
// Theme Template Functions
// ============================================================================

/**
 * Get all product templates from the active theme
 * @param {Function} graphql - Shopify GraphQL client
 * @returns {Promise<Array<{suffix: string, name: string}>>} Array of templates
 */
export async function vepoGetProductTemplates(graphql) {
  try {
    const response = await vepoGraphqlWithRetry(
      graphql,
      `
        query vepoGetProductTemplates {
          themes(first: 1, roles: MAIN) {
            nodes {
              id
              name
              files(filenames: ["templates/product*"], first: 50) {
                nodes {
                  filename
                }
              }
            }
          }
        }
      `,
      {}
    );

    const { data } = await response.json();
    const theme = data?.themes?.nodes?.[0];

    if (!theme?.files?.nodes) {
      return [];
    }

    const templates = theme.files.nodes
      .map((file) => {
        const filename = file.filename;
        // Extract suffix from filename like "templates/product.vepo-rollo.json" or "templates/product.vepo-rollo.liquid"
        const match = filename.match(/templates\/product\.([^.]+)\.(json|liquid)$/);
        if (match) {
          return {
            suffix: match[1],
            name: `product.${match[1]}`,
          };
        }
        // Default template (templates/product.json or templates/product.liquid)
        if (filename.match(/templates\/product\.(json|liquid)$/)) {
          return {
            suffix: "",
            name: "product (Standard)",
          };
        }
        return null;
      })
      .filter(Boolean);

    return templates;
  } catch (error) {
    console.error("[Vepo] Error getting product templates:", error);
    return [];
  }
}

/**
 * Set the template suffix for multiple products
 * @param {string[]} productIds - Array of Shopify product GIDs
 * @param {string} templateSuffix - The template suffix to set (or empty string for default)
 * @param {Function} graphql - Shopify GraphQL client
 * @returns {Promise<{success: boolean, errors: string[]}>}
 */
export async function vepoSetProductTemplate(productIds, templateSuffix, graphql) {
  const errors = [];

  for (const productId of productIds) {
    try {
      const response = await vepoGraphqlWithRetry(
        graphql,
        `
          mutation vepoSetProductTemplate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                templateSuffix
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          variables: {
            input: {
              id: productId,
              templateSuffix: templateSuffix || null,
            },
          },
        }
      );

      const { data } = await response.json();
      const userErrors = data?.productUpdate?.userErrors;

      if (userErrors?.length > 0) {
        errors.push(`Product ${productId}: ${userErrors.map((e) => e.message).join(", ")}`);
      }
    } catch (error) {
      console.error(`[Vepo] Error setting template for product ${productId}:`, error);
      errors.push(`Product ${productId}: ${error.message}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
