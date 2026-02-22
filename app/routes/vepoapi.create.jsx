import { json } from "@remix-run/node";
import {
  vepoConfigureProduct,
  vepoGetConfigByProductId,
} from "../models/VepoConfigurator.server";
import shopify from "../shopify.server";

export async function loader({ request }) {
  const { session, admin } = await shopify.authenticate.public.appProxy(request);
  if (!session) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const config = url.searchParams.get("config");
    const price = url.searchParams.get("p");
    const variantTitle = url.searchParams.get("title");
    const weight = url.searchParams.get("weight");

    if (!productId) {
      return json({ error: "Product ID is required" }, { status: 400 });
    }

    // Retrieve original product configuration
    const originalProduct = await vepoGetConfigByProductId(
      "gid://shopify/Product/" + productId,
      admin.graphql
    );

    if (!originalProduct) {
      return json({ error: "Product configuration not found" }, { status: 404 });
    }

    const priceFormula = originalProduct.ProductConfigurationOptions.priceFormula;
    const priceMode = originalProduct.ProductConfigurationOptions.priceMode;

    // Get unified SKU if enabled
    let skuToUse = null;
    if (
      originalProduct.ProductConfigurationOptions.useUnifiedSku &&
      originalProduct.ProductConfigurationOptions.unifiedSku
    ) {
      skuToUse = originalProduct.ProductConfigurationOptions.unifiedSku;
    }

    // Only use weight if provided
    const weightToUse = weight ? weight : null;

    console.log("[Vepo] Creating variant for product:", productId, "price:", price, "mode:", priceMode);

    const response = await vepoConfigureProduct(
      originalProduct,
      config,
      price,
      priceFormula,
      admin.graphql,
      session,
      admin,
      priceMode,
      variantTitle || null,
      weightToUse,
      skuToUse
    );

    console.log("[Vepo] Create variant result:", JSON.stringify(response));

    if (!response.productVariantID) {
      return json({ error: "Failed to create variant", details: response }, { status: 500 });
    }

    return json(response);
  } catch (error) {
    console.error("[Vepo] Error creating variant:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
