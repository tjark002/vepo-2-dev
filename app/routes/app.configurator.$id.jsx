import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useNavigation,
  useActionData,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Button,
  Badge,
  Banner,
  Checkbox,
  Select,
  Divider,
  Icon,
  Collapsible,
  Modal,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  ColorIcon,
  ImageIcon,
  TextFontIcon,
  HashtagIcon,
  CheckboxIcon,
  CalendarIcon,
  AttachmentIcon,
  ListBulletedIcon,
  SelectIcon,
  DeleteIcon,
  DuplicateIcon,
  ExportIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  vepoGetConfiguration,
  vepoValidateProductConfig,
  vepoDeleteConfiguration,
  vepoCreateBulkVariants,
  vepoCreateBulkVirtualVariants,
  vepoAddTagsToProduct,
  vepoGetProductTemplates,
  vepoSetProductTemplate,
} from "../models/VepoConfigurator.server";
import OptionPicker from "../components/OptionPicker";
import PriceFormulaEditor from "../components/PriceFormulaEditor";
import ProductList from "../components/ProductList";
import VirtualVariantsTable from "../components/VirtualVariantsTable";
import RulesEditor from "../components/RulesEditor";

// Parse float or return 0 for empty/invalid values (DB has NOT NULL constraint with default 0)
const parseFloatOrNull = (value) => {
  if (value === null || value === undefined || value === "" || value === "null") {
    return 0;
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const OPTION_TYPE_ICONS = {
  variantswatch: ListBulletedIcon,
  dropdown: SelectIcon,
  colorswatch: ColorIcon,
  imageswatch: ImageIcon,
  dimension: HashtagIcon,
  dimensionselect: ListBulletedIcon,
  text: TextFontIcon,
  checkbox: CheckboxIcon,
  date: CalendarIcon,
  file: AttachmentIcon,
};

const OPTION_TYPE_LABELS = {
  variantswatch: "Klassische Textkacheln",
  dropdown: "Dropdown-Auswahl",
  colorswatch: "Farbkacheln",
  imageswatch: "Bildkacheln",
  dimension: "Maße",
  dimensionselect: "Maß-Auswahl",
  text: "Texteingabe",
  checkbox: "Einzelne Checkbox",
  date: "Datum Eingabe",
  file: "Datei",
};

// Normalize data for comparison - extract only relevant fields to avoid server-side field differences
function normalizeForComparison(data, debug = false) {
  // Helper to safely parse values (could be string or array)
  const normalizeValues = (values) => {
    if (!values) return "[]";
    if (typeof values === "string") {
      try {
        // Validate it's valid JSON, then return as-is
        JSON.parse(values);
        return values;
      } catch {
        return "[]";
      }
    }
    return JSON.stringify(values);
  };

  const normalizeOption = (opt) => ({
    id: opt.id || opt.tempId || null,
    name: opt.name || "",
    type: opt.type || "",
    required: Boolean(opt.required),
    description: opt.description || "",
    isMultiselect: Boolean(opt.isMultiselect),
    isPreselected: Boolean(opt.isPreselected),
    hasAdditionalPrice: Boolean(opt.hasAdditionalPrice),
    additionalPrice: Number(opt.additionalPrice) || 0,
    checkBoxLabel: opt.checkBoxLabel || "",
    maxLength: Number(opt.maxLength) || 0,
    placeholder: opt.placeholder || "",
    min: Number(opt.min) || 0,
    max: Number(opt.max) || 0,
    default: Number(opt.default) || 0,
    unit: opt.unit || "",
    allowedFileTypes: opt.allowedFileTypes || "",
    values: normalizeValues(opt.values),
    displayMode: opt.displayMode || "",
    allowAllDates: opt.allowAllDates !== false,
    minDate: opt.minDate || "",
    maxDate: opt.maxDate || "",
    decimalPlaces: Number.isFinite(Number(opt.decimalPlaces)) ? Number(opt.decimalPlaces) : -1,
  });

  const normalizeProduct = (p) => ({
    productId: p.productId || "",
    productHandle: p.productHandle || "",
    productVariantId: p.productVariantId || "",
  });

  const normalizeVirtualVariant = (vv) => ({
    variantHandle: vv.variantHandle || "",
    variantPrice: Number(vv.variantPrice) || 0,
    manualPrice: Boolean(vv.manualPrice),
  });

  const normalizeRule = (r) => ({
    id: r.id || null,
    targetOptionId: r.targetOptionId || null,
    targetValueId: r.targetValueId || null,
    show: Boolean(r.show),
    priority: Number(r.priority) || 0,
    conditions: (r.conditions || []).map((c) => ({
      optionId: c.optionId || null,
      operator: c.operator || "",
      value: c.value || "",
    })),
  });

  const result = {
    title: data.title || "",
    priceFormula: data.priceFormula || "",
    options: (data.options || []).map(normalizeOption),
    optionOrder: (data.optionOrder || []).map(id => id || null),
    configurableProducts: (data.configurableProducts || []).map(normalizeProduct),
    virtualVariants: (data.virtualVariants || []).map(normalizeVirtualVariant),
    rules: (data.rules || []).map(normalizeRule),
    activateSurcharges: Boolean(data.activateSurcharges),
    formulaModeSurcharges: data.formulaModeSurcharges !== false,
    useVariantNameInFormula: data.useVariantNameInFormula !== false,
    useUnifiedSku: Boolean(data.useUnifiedSku),
    unifiedSku: data.unifiedSku || "",
    minimumPrice: String(Number(data.minimumPrice) || 0),
    useMinimumPrice: Boolean(data.useMinimumPrice),
    roundingEnabled: Boolean(data.roundingEnabled),
    roundingPrecision: String(data.roundingPrecision || "1"),
    basePrice: String(Number(data.basePrice) || 0),
    redirectToDifferentPage: Boolean(data.redirectToDifferentPage),
    redirectLink: data.redirectLink || "",
    templateSuffix: data.templateSuffix || "",
  };

  if (debug) {
    console.log("[Vepo Debug] Normalized data:", result);
  }

  return JSON.stringify(result);
}

// ============================================================================
// Loader
// ============================================================================

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { id } = params;

  // "new" is handled by app.configurator.new.jsx now – redirect as fallback
  if (id === "new") {
    return redirect("/app/configurator/new");
  }

  const configuration = await vepoGetConfiguration(parseInt(id), admin.graphql);
  if (!configuration) {
    throw new Response("Configuration not found", { status: 404 });
  }

  // Format price values on load
  configuration.basePrice = parseFloat(configuration.basePrice || 0).toFixed(2);
  configuration.minimumPrice = parseFloat(configuration.minimumPrice || 0).toFixed(2);
  
  // Format virtual variant prices
  if (configuration.virtualVariants) {
    configuration.virtualVariants = configuration.virtualVariants.map((v) => ({
      ...v,
      variantPrice: parseFloat(v.variantPrice || 0).toFixed(2),
    }));
  }
  
  // Format option surcharge values
  if (configuration.options) {
    configuration.options = configuration.options.map((opt) => ({
      ...opt,
      additionalPrice: parseFloat(opt.additionalPrice || 0).toFixed(2),
      values: Array.isArray(opt.values) ? opt.values.map((v) => ({
        ...v,
        surcharge: v.surcharge !== undefined ? parseFloat(v.surcharge || 0).toFixed(2) : "0.00",
      })) : [],
    }));
  }

  // Load available product templates from the active theme
  const templates = await vepoGetProductTemplates(admin.graphql);

  // Load all product IDs that are already assigned to OTHER configurations
  const allConfigurableProducts = await db.configurableProduct.findMany({
    where: {
      shop: session.shop,
      optionsId: { not: parseInt(id) }, // Exclude products from current config
    },
    select: { productId: true },
  });
  const usedProductIds = allConfigurableProducts.map((cp) => cp.productId);

  // Load all other configurations for "copy option to" feature
  const otherConfigurators = await db.productConfigurationOptions.findMany({
    where: {
      shop: session.shop,
      id: { not: parseInt(id) },
    },
    select: { id: true, title: true, priceMode: true },
    orderBy: { title: "asc" },
  });

  return json({ configuration, shop: session.shop, templates, usedProductIds, otherConfigurators });
};

// ============================================================================
// Action
// ============================================================================

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  // Delete action
  if (actionType === "delete") {
    const configId = parseInt(params.id);
    const configTitle = formData.get("configTitle") || "";
    await vepoDeleteConfiguration(configId, configTitle, admin.graphql);
    return redirect("/app");
  }

  // Copy option to another configurator
  if (actionType === "copyOptionTo") {
    const optionData = JSON.parse(formData.get("optionData") || "{}");
    const targetConfigId = parseInt(formData.get("targetConfigId"));

    if (!optionData || !targetConfigId) {
      return json({ error: "Missing option data or target config" }, { status: 400 });
    }

    // Get target config's option order
    const targetConfig = await db.productConfigurationOptions.findUnique({
      where: { id: targetConfigId },
      select: { optionOrder: true },
    });

    if (!targetConfig) {
      return json({ error: "Target configuration not found" }, { status: 404 });
    }

    // Create the option in the target config
    const newOption = await db.option.create({
      data: {
        shop: session.shop,
        name: optionData.name || "Kopierte Option",
        type: optionData.type,
        required: optionData.required || false,
        description: optionData.description || "",
        isMultiselect: optionData.isMultiselect || false,
        isPreselected: optionData.isPreselected || false,
        hasAdditionalPrice: optionData.hasAdditionalPrice || false,
        additionalPrice: parseFloat(optionData.additionalPrice) || 0,
        checkBoxLabel: optionData.checkBoxLabel || "",
        maxLength: parseInt(optionData.maxLength) || 0,
        placeholder: optionData.placeholder || "",
        min: parseFloatOrNull(optionData.min),
        max: parseFloatOrNull(optionData.max),
        default: parseFloatOrNull(optionData.default),
        unit: optionData.unit || "",
        allowedFileTypes: optionData.allowedFileTypes || "",
        values: typeof optionData.values === "string" ? optionData.values : JSON.stringify(optionData.values || []),
        displayMode: optionData.displayMode || "",
        allowAllDates: optionData.allowAllDates !== false,
        minDate: optionData.minDate || "",
        maxDate: optionData.maxDate || "",
        decimalPlaces: parseInt(optionData.decimalPlaces) ?? -1,
        productConfigurations: { connect: { id: targetConfigId } },
      },
    });

    // Update target config's option order
    let optionOrder = [];
    try {
      optionOrder = JSON.parse(targetConfig.optionOrder || "[]");
    } catch {
      optionOrder = [];
    }
    optionOrder.push(newOption.id);

    await db.productConfigurationOptions.update({
      where: { id: targetConfigId },
      data: { optionOrder: JSON.stringify(optionOrder) },
    });

    return json({ success: true, action: "copyOptionTo", newOptionId: newOption.id });
  }

  // Save action – configuration always exists (created via setup page)
  const configId = parseInt(params.id);

  // Read the existing config to get the immutable priceMode
  const existingConfig = await db.productConfigurationOptions.findUnique({
    where: { id: configId },
  });
  if (!existingConfig) {
    throw new Response("Configuration not found", { status: 404 });
  }

  const data = {
    title: formData.get("title"),
    priceFormula: formData.get("priceFormula") || "",
    activateSurcharges: formData.get("activateSurcharges") === "true",
    formulaModeSurcharges: formData.get("formulaModeSurcharges") === "true",
    useVariantNameInFormula: formData.get("useVariantNameInFormula") === "true",
    useUnifiedSku: formData.get("useUnifiedSku") === "true",
    unifiedSku: formData.get("unifiedSku") || "",
    minimumPrice: parseFloat(formData.get("minimumPrice")) || 0,
    useMinimumPrice: formData.get("useMinimumPrice") === "true",
    roundingEnabled: formData.get("roundingEnabled") === "true",
    roundingPrecision: formData.get("roundingPrecision") || "1",
    basePrice: parseFloat(formData.get("basePrice")) || 0,
    redirectToDifferentPage: formData.get("redirectToDifferentPage") === "true",
    redirectLink: formData.get("redirectLink") || "",
    configurableProducts: formData.get("configurableProducts"),
    options: formData.get("options"),
    optionOrder: formData.get("optionOrder"),
    virtualVariants: formData.get("virtualVariants"),
    rules: formData.get("rules"),
  };

  // priceMode comes from DB (immutable after creation)
  const priceMode = existingConfig.priceMode;

  // Validate
  const validation = await vepoValidateProductConfig(data, configId);
  if (validation.errors) {
    return json({ errors: validation.errors }, { status: 422 });
  }

  // Update configuration (priceMode is NOT updated)
  await db.productConfigurationOptions.update({
    where: { id: configId },
    data: {
      title: data.title,
      priceFormula: data.priceFormula,
      activateSurcharges: data.activateSurcharges,
      formulaModeSurcharges: data.formulaModeSurcharges,
      useVariantNameInFormula: data.useVariantNameInFormula,
      useUnifiedSku: data.useUnifiedSku,
      unifiedSku: data.unifiedSku,
      minimumPrice: data.minimumPrice,
      useMinimumPrice: data.useMinimumPrice,
      roundingEnabled: data.roundingEnabled,
      roundingPrecision: data.roundingPrecision,
      basePrice: data.basePrice,
      redirectToDifferentPage: data.redirectToDifferentPage,
      redirectLink: data.redirectLink,
    },
  });

  // Handle configurable products
  let configurableProducts = [];
  try {
    configurableProducts = JSON.parse(data.configurableProducts || "[]");
  } catch {
    configurableProducts = [];
  }

  // Remove old products and add new
  await db.configurableProduct.deleteMany({ where: { optionsId: configId } });

  for (const cp of configurableProducts) {
    await db.configurableProduct.create({
      data: {
        shop: session.shop,
        productId: cp.productId,
        productHandle: cp.productHandle || "",
        productVariantId: cp.productVariantId || "",
        optionsId: configId,
      },
    });

    // Add tags
    await vepoAddTagsToProduct(cp.productId, admin.graphql, [
      "vepo-configurator",
      data.title.toLowerCase().replace(/ /g, "-"),
    ]);
  }

  // Handle options
  let options = [];
  try {
    options = JSON.parse(data.options || "[]");
  } catch {
    options = [];
  }

  // Remove old options linked to this config
  const existingOptions = await db.option.findMany({
    where: { productConfigurations: { some: { id: configId } } },
  });

  for (const eo of existingOptions) {
    await db.condition.deleteMany({ where: { optionId: eo.id } });
    await db.option.update({
      where: { id: eo.id },
      data: { productConfigurations: { disconnect: { id: configId } } },
    });
  }

  // Delete orphaned options (not connected to any config)
  for (const eo of existingOptions) {
    const remaining = await db.option.findUnique({
      where: { id: eo.id },
      include: { productConfigurations: true },
    });
    if (remaining && remaining.productConfigurations.length === 0) {
      // Delete OptionRules that reference this option as targetOption (and their conditions)
      const rulesReferencingOption = await db.optionRule.findMany({
        where: { targetOptionId: eo.id },
      });
      for (const rule of rulesReferencingOption) {
        await db.condition.deleteMany({ where: { ruleId: rule.id } });
      }
      await db.optionRule.deleteMany({ where: { targetOptionId: eo.id } });
      
      // Delete conditions that reference this option, and orphaned rules
      const conditionsUsingOption = await db.condition.findMany({
        where: { optionId: eo.id },
        select: { id: true, ruleId: true },
      });
      const affectedRuleIds = [...new Set(conditionsUsingOption.map(c => c.ruleId))];
      await db.condition.deleteMany({ where: { optionId: eo.id } });
      
      // Delete rules that have no remaining conditions
      for (const ruleId of affectedRuleIds) {
        const remainingConditions = await db.condition.count({ where: { ruleId } });
        if (remainingConditions === 0) {
          await db.optionRule.delete({ where: { id: ruleId } });
        }
      }
      
      await db.option.delete({ where: { id: eo.id } });
    }
  }

  // Create/update options
  const newOptionIds = [];
  const optionIdMap = {};

  for (const option of options) {
    const optionData = {
      shop: session.shop,
      name: option.name || "Unbenannt",
      type: option.type,
      required: option.required || false,
      description: option.description || "",
      isMultiselect: option.isMultiselect || false,
      isPreselected: option.isPreselected || false,
      hasAdditionalPrice: option.hasAdditionalPrice || false,
      additionalPrice: parseFloat(option.additionalPrice) || 0,
      checkBoxLabel: option.checkBoxLabel || "",
      maxLength: parseInt(option.maxLength) || 0,
      placeholder: option.placeholder || "",
      min: parseFloatOrNull(option.min),
      max: parseFloatOrNull(option.max),
      default: parseFloatOrNull(option.default),
      unit: option.unit || "",
      allowedFileTypes: option.allowedFileTypes || "",
      values: typeof option.values === "string" ? option.values : JSON.stringify(option.values || []),
      displayMode: option.displayMode || "",
      allowAllDates: option.allowAllDates !== false,
      minDate: option.minDate || "",
      maxDate: option.maxDate || "",
      productBundleVariantId: option.productBundleVariantId || "",
      decimalPlaces: parseInt(option.decimalPlaces) ?? -1,
    };

    let savedOption;
    if (option.id && typeof option.id === "number") {
      // Try to update existing
      try {
        savedOption = await db.option.update({
          where: { id: option.id },
          data: {
            ...optionData,
            productConfigurations: { connect: { id: configId } },
          },
        });
      } catch {
        savedOption = await db.option.create({
          data: {
            ...optionData,
            productConfigurations: { connect: { id: configId } },
          },
        });
      }
    } else {
      savedOption = await db.option.create({
        data: {
          ...optionData,
          productConfigurations: { connect: { id: configId } },
        },
      });
    }

    optionIdMap[option.id || option.tempId] = savedOption.id;
    newOptionIds.push(savedOption.id);
  }

  // Update option order
  let optionOrder = [];
  try {
    const rawOrder = JSON.parse(data.optionOrder || "[]");
    optionOrder = rawOrder.map((id) => optionIdMap[id] || id);
  } catch {
    optionOrder = newOptionIds;
  }

  await db.productConfigurationOptions.update({
    where: { id: configId },
    data: { optionOrder: JSON.stringify(optionOrder) },
  });

  // Handle virtual variants
  await db.virtualProductVariant.deleteMany({ where: { configurationId: configId } });

  let virtualVariants = [];
  try {
    virtualVariants = JSON.parse(data.virtualVariants || "[]");
  } catch {
    virtualVariants = [];
  }

  for (const vv of virtualVariants) {
    await db.virtualProductVariant.create({
      data: {
        shop: session.shop,
        variantHandle: vv.variantHandle,
        configurationId: configId,
        variantPrice: parseFloat(vv.variantPrice) || 0,
        manualPrice: vv.manualPrice === true,
      },
    });
  }

  // Handle rules
  const existingRules = await db.optionRule.findMany({
    where: { configurationId: configId },
  });
  for (const r of existingRules) {
    await db.condition.deleteMany({ where: { ruleId: r.id } });
  }
  await db.optionRule.deleteMany({ where: { configurationId: configId } });

  let rules = [];
  try {
    rules = JSON.parse(data.rules || "[]");
  } catch {
    rules = [];
  }

  for (const rule of rules) {
    const targetOptionId = optionIdMap[rule.targetOptionId] || parseInt(rule.targetOptionId);
    if (!targetOptionId) continue;

    const newRule = await db.optionRule.create({
      data: {
        shop: session.shop,
        configurationId: configId,
        show: rule.show,
        targetOptionId: targetOptionId,
        targetValueId: rule.targetValueId || null,
        priority: rule.priority || 0,
      },
    });

    for (const condition of rule.conditions || []) {
      const condOptionId = optionIdMap[condition.optionId] || parseInt(condition.optionId);
      if (!condOptionId) continue;

      await db.condition.create({
        data: {
          shop: session.shop,
          ruleId: newRule.id,
          optionId: condOptionId,
          operator: condition.operator,
          value: condition.value,
        },
      });
    }
  }

  // Create bulk variants based on mode
  const finalProducts = await db.configurableProduct.findMany({
    where: { optionsId: configId },
  });

  if (priceMode === "price-formula") {
    await vepoCreateBulkVariants(finalProducts, admin.graphql, data.useUnifiedSku, data.unifiedSku, data.minimumPrice);
  } else if (priceMode === "variant-price") {
    await vepoCreateBulkVirtualVariants(finalProducts, virtualVariants, admin.graphql);
  }

  // Handle template suffix - set template for all assigned products
  const templateSuffix = formData.get("templateSuffix") || "";
  
  // Save templateSuffix to config
  await db.productConfigurationOptions.update({
    where: { id: configId },
    data: { templateSuffix: templateSuffix || null },
  });

  // Set template on products if templateSuffix is set and there are products
  if (templateSuffix && configurableProducts.length > 0) {
    const productIds = configurableProducts.map((cp) => cp.productId);
    const templateResult = await vepoSetProductTemplate(productIds, templateSuffix, admin.graphql);
    
    if (!templateResult.success) {
      console.error("[Vepo] Some template assignments failed:", templateResult.errors);
    }
  }

  return json({ success: true, optionIdMap, configId });
};

// ============================================================================
// Component
// ============================================================================

export default function ConfiguratorEditor() {
  const { configuration, shop, templates, usedProductIds, otherConfigurators } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const shopify = useAppBridge();

  // Configuration always exists at this point (created via /app/configurator/new)

  // Form state
  const [title, setTitle] = useState(configuration?.title || "");
  // Price mode is set during creation and cannot be changed afterwards
  const priceMode = configuration?.priceMode || "price-formula";
  const [priceFormula, setPriceFormula] = useState(configuration?.priceFormula || "");
  const [activateSurcharges, setActivateSurcharges] = useState(configuration?.activateSurcharges || false);
  const [formulaModeSurcharges, setFormulaModeSurcharges] = useState(configuration?.formulaModeSurcharges ?? true);
  const [useVariantNameInFormula, setUseVariantNameInFormula] = useState(configuration?.useVariantNameInFormula ?? true);
  const [useUnifiedSku, setUseUnifiedSku] = useState(configuration?.useUnifiedSku || false);
  const [unifiedSku, setUnifiedSku] = useState(configuration?.unifiedSku || "");
  const [minimumPrice, setMinimumPrice] = useState(String(configuration?.minimumPrice || 0));
  const [useMinimumPrice, setUseMinimumPrice] = useState(configuration?.useMinimumPrice || false);
  const [roundingEnabled, setRoundingEnabled] = useState(configuration?.roundingEnabled || false);
  const [roundingPrecision, setRoundingPrecision] = useState(String(configuration?.roundingPrecision || "1"));
  const [basePrice, setBasePrice] = useState(String(configuration?.basePrice || 0));
  const [redirectToDifferentPage, setRedirectToDifferentPage] = useState(configuration?.redirectToDifferentPage || false);
  const [redirectLink, setRedirectLink] = useState(configuration?.redirectLink || "");
  const [templateSuffix, setTemplateSuffix] = useState(configuration?.templateSuffix || "");

  const [configurableProducts, setConfigurableProducts] = useState(
    configuration?.configurableProducts || []
  );
  const [options, setOptions] = useState(configuration?.options || []);
  const [optionOrder, setOptionOrder] = useState(() => {
    try {
      return JSON.parse(configuration?.optionOrder || "[]");
    } catch {
      return [];
    }
  });
  const [virtualVariants, setVirtualVariants] = useState(configuration?.virtualVariants || []);
  const [rules, setRules] = useState(configuration?.rules || []);

  const [optionPickerOpen, setOptionPickerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const [pendingOptionNavigation, setPendingOptionNavigation] = useState(null);
  const [isSavingAndNavigating, setIsSavingAndNavigating] = useState(false);
  const navigateAfterSaveRef = useRef(null);
  const [copyToModalOpen, setCopyToModalOpen] = useState(false);
  const [copyingOption, setCopyingOption] = useState(null);
  const [selectedTargetConfig, setSelectedTargetConfig] = useState("");

  // Dirty state tracking – all fields that can change (priceMode excluded: immutable after creation)
  const initialStateRef = useRef(normalizeForComparison({
    title: configuration?.title,
    priceFormula: configuration?.priceFormula,
    options: configuration?.options,
    optionOrder: (() => { try { return JSON.parse(configuration?.optionOrder || "[]"); } catch { return []; } })(),
    configurableProducts: configuration?.configurableProducts,
    virtualVariants: configuration?.virtualVariants,
    rules: configuration?.rules,
    activateSurcharges: configuration?.activateSurcharges,
    formulaModeSurcharges: configuration?.formulaModeSurcharges,
    useVariantNameInFormula: configuration?.useVariantNameInFormula,
    useUnifiedSku: configuration?.useUnifiedSku,
    unifiedSku: configuration?.unifiedSku,
    minimumPrice: configuration?.minimumPrice,
    useMinimumPrice: configuration?.useMinimumPrice,
    roundingEnabled: configuration?.roundingEnabled,
    roundingPrecision: configuration?.roundingPrecision,
    basePrice: configuration?.basePrice,
    redirectToDifferentPage: configuration?.redirectToDifferentPage,
    redirectLink: configuration?.redirectLink,
    templateSuffix: configuration?.templateSuffix,
  }));

  // Counter to force re-computation of isDirty after save
  const [saveVersion, setSaveVersion] = useState(0);

  const isDirty = useMemo(() => {
    const current = normalizeForComparison({
      title, priceFormula, options, optionOrder,
      configurableProducts, virtualVariants, rules,
      activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
      useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
      roundingEnabled, roundingPrecision,
      basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
    });
    const initial = initialStateRef.current;
    return current !== initial;
  }, [
    title, priceFormula, options, optionOrder,
    configurableProducts, virtualVariants, rules,
    activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
    useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
    roundingEnabled, roundingPrecision,
    basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
    saveVersion, // This forces re-computation after save
  ]);

  // Ordered options
  const orderedOptions = useMemo(() => {
    if (optionOrder.length === 0) return options;
    const ordered = [];
    for (const id of optionOrder) {
      const opt = options.find((o) => (o.id || o.tempId) === id);
      if (opt) ordered.push(opt);
    }
    // Add any options not in the order
    for (const opt of options) {
      if (!ordered.includes(opt)) ordered.push(opt);
    }
    return ordered;
  }, [options, optionOrder]);

  // Build form data (shared between save and auto-save)
  // Note: priceMode is NOT included – it is immutable after creation
  const buildFormData = useCallback(() => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("priceFormula", priceFormula);
    formData.append("activateSurcharges", String(activateSurcharges));
    formData.append("formulaModeSurcharges", String(formulaModeSurcharges));
    formData.append("useVariantNameInFormula", String(useVariantNameInFormula));
    formData.append("useUnifiedSku", String(useUnifiedSku));
    formData.append("unifiedSku", unifiedSku);
    formData.append("minimumPrice", minimumPrice);
    formData.append("useMinimumPrice", String(useMinimumPrice));
    formData.append("roundingEnabled", String(roundingEnabled));
    formData.append("roundingPrecision", roundingPrecision);
    formData.append("basePrice", basePrice);
    formData.append("redirectToDifferentPage", String(redirectToDifferentPage));
    formData.append("redirectLink", redirectLink);
    formData.append("templateSuffix", templateSuffix);
    formData.append("configurableProducts", JSON.stringify(configurableProducts));
    formData.append("options", JSON.stringify(options));
    formData.append(
      "optionOrder",
      JSON.stringify(optionOrder.length ? optionOrder : options.map((o) => o.id || o.tempId))
    );
    formData.append("virtualVariants", JSON.stringify(virtualVariants));
    formData.append("rules", JSON.stringify(rules));

    return formData;
  }, [
    title, priceFormula, activateSurcharges, formulaModeSurcharges,
    useVariantNameInFormula, useUnifiedSku, unifiedSku, minimumPrice,
    useMinimumPrice, basePrice, redirectToDifferentPage, redirectLink,
    templateSuffix, configurableProducts, options, optionOrder, virtualVariants, rules,
  ]);

  // Handlers
  // Ref to store the state snapshot when save is initiated
  const savedStateSnapshotRef = useRef(null);

  const handleSave = useCallback(() => {
    // Capture the current state at the moment of save
    savedStateSnapshotRef.current = {
      title, priceFormula, options, optionOrder,
      configurableProducts, virtualVariants, rules,
      activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
      useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
      roundingEnabled, roundingPrecision,
      basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
    };
    submit(buildFormData(), { method: "post" });
  }, [
    submit, buildFormData, title, priceFormula, options, optionOrder,
    configurableProducts, virtualVariants, rules,
    activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
    useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
    roundingEnabled, roundingPrecision,
    basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
  ]);

  // Navigate to option editor
  const handleOptionClick = useCallback(
    (optionId) => {
      // Find the option to pass its type as query param
      const opt = options.find((o) => (o.id || o.tempId) === optionId);
      const type = opt?.type || "text";
      const targetUrl = `/app/option/${optionId}/${configuration.id}?type=${type}&priceMode=${priceMode}`;
      
      // For new options (tempId): Check if there are OTHER changes besides this option
      const isNewOption = typeof optionId === "string" && optionId.startsWith("opt_");
      
      if (isNewOption && isDirty) {
        // Calculate if there are changes when we exclude this new option
        const optionsWithoutThis = options.filter((o) => (o.id || o.tempId) !== optionId);
        const orderWithoutThis = optionOrder.filter((id) => id !== optionId);
        
        const stateWithoutThisOption = normalizeForComparison({
          title, priceFormula, options: optionsWithoutThis, optionOrder: orderWithoutThis,
          configurableProducts, virtualVariants, rules,
          activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
          useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
          roundingEnabled, roundingPrecision,
          basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
        });
        
        const hasOtherChanges = stateWithoutThisOption !== initialStateRef.current;
        
        if (!hasOtherChanges) {
          // No other changes, navigate directly
          navigate(targetUrl);
          return;
        }
      }
      
      // Check for unsaved changes before navigating
      if (isDirty) {
        setPendingOptionNavigation(targetUrl);
      } else {
        navigate(targetUrl);
      }
    },
    [
      configuration, navigate, options, optionOrder, isDirty, priceMode,
      title, priceFormula, configurableProducts, virtualVariants, rules,
      activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
      useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
      roundingEnabled, roundingPrecision, basePrice, redirectToDifferentPage,
      redirectLink, templateSuffix,
    ]
  );


  const handleDiscard = useCallback(() => {
    // Reset to initial state
    setTitle(configuration?.title || "");
    setPriceFormula(configuration?.priceFormula || "");
    setOptions(configuration?.options || []);
    setConfigurableProducts(configuration?.configurableProducts || []);
    setVirtualVariants(configuration?.virtualVariants || []);
    setRules(configuration?.rules || []);
    setActivateSurcharges(configuration?.activateSurcharges || false);
    setFormulaModeSurcharges(configuration?.formulaModeSurcharges ?? true);
    setUseVariantNameInFormula(configuration?.useVariantNameInFormula ?? true);
    setUseUnifiedSku(configuration?.useUnifiedSku || false);
    setUnifiedSku(configuration?.unifiedSku || "");
    setMinimumPrice(String(configuration?.minimumPrice || 0));
    setUseMinimumPrice(configuration?.useMinimumPrice || false);
    setRoundingEnabled(configuration?.roundingEnabled || false);
    setRoundingPrecision(String(configuration?.roundingPrecision || "1"));
    setBasePrice(String(configuration?.basePrice || 0));
    setRedirectToDifferentPage(configuration?.redirectToDifferentPage || false);
    setRedirectLink(configuration?.redirectLink || "");
    setTemplateSuffix(configuration?.templateSuffix || "");
  }, [configuration]);

  const handleAddProduct = useCallback(async () => {
    // Build set of product IDs that should NOT be selectable:
    // 1. Products already used in OTHER configurations
    // 2. Products already added to THIS configuration
    const currentProductIds = configurableProducts.map((p) => p.productId);
    const allUsedIds = new Set([...usedProductIds, ...currentProductIds]);

    // Use query to filter out already-used products from the picker
    // Note: Shopify resourcePicker doesn't support "exclude" directly,
    // so we filter the results after selection
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: [], // Start with no pre-selection
      filter: {
        variants: false, // Only show products, not individual variants
      },
    });
    if (!selected) return;

    // Filter out products that are already used in other configurations
    const availableProducts = selected.filter((product) => !allUsedIds.has(product.id));

    // Warn user if some products were skipped
    if (availableProducts.length < selected.length) {
      const skippedCount = selected.length - availableProducts.length;
      shopify.toast.show(
        `${skippedCount} Produkt${skippedCount > 1 ? "e" : ""} übersprungen (bereits in anderem Konfigurator)`,
        { isError: true }
      );
    }

    if (availableProducts.length === 0) return;

    const newProducts = availableProducts.map((product) => ({
      productId: product.id,
      productHandle: product.handle,
      productVariantId: product.variants?.[0]?.id || "",
      productTitle: product.title,
      productImage: product.images?.[0]?.originalSrc || null,
      productAlt: product.images?.[0]?.altText || null,
    }));

    // Merge, avoiding duplicates
    const existing = new Set(configurableProducts.map((p) => p.productId));
    const merged = [
      ...configurableProducts,
      ...newProducts.filter((p) => !existing.has(p.productId)),
    ];
    setConfigurableProducts(merged);
  }, [shopify, configurableProducts, usedProductIds]);

  const handleRemoveProduct = useCallback(
    (productId) => {
      setConfigurableProducts((prev) =>
        prev.filter((p) => p.productId !== productId)
      );
    },
    []
  );

  const handleAddOption = useCallback(
    (type) => {
      const newOption = {
        tempId: "opt_" + Date.now(),
        name: "",
        type,
        required: false,
        description: "",
        isMultiselect: false,
        isPreselected: false,
        hasAdditionalPrice: false,
        additionalPrice: 0,
        checkBoxLabel: "",
        maxLength: 0,
        placeholder: "",
        min: 0,
        max: 0,
        default: 0,
        unit: "",
        allowedFileTypes: "",
        values: [],
        displayMode: "",
        allowAllDates: true,
        minDate: "",
        maxDate: "",
        decimalPlaces: -1,
      };
      setOptions((prev) => [...prev, newOption]);
      setOptionOrder((prev) => [...prev, newOption.tempId]);
    },
    []
  );

  const handleRemoveOption = useCallback(
    (optionId) => {
      setOptions((prev) => prev.filter((o) => (o.id || o.tempId) !== optionId));
      setOptionOrder((prev) => prev.filter((id) => id !== optionId));
    },
    []
  );

  const handleDuplicateOption = useCallback(
    (optionId) => {
      const originalOption = options.find((o) => (o.id || o.tempId) === optionId);
      if (!originalOption) return;

      const newTempId = "opt_" + Date.now();
      const duplicatedOption = {
        ...originalOption,
        id: undefined,
        tempId: newTempId,
        name: originalOption.name + " (Kopie)",
      };

      const originalIndex = optionOrder.indexOf(optionId);
      
      setOptions((prev) => [...prev, duplicatedOption]);
      setOptionOrder((prev) => {
        const newOrder = [...prev];
        if (originalIndex >= 0) {
          newOrder.splice(originalIndex + 1, 0, newTempId);
        } else {
          newOrder.push(newTempId);
        }
        return newOrder;
      });

      shopify.toast.show(`Option "${originalOption.name}" dupliziert`);
    },
    [options, optionOrder, shopify]
  );

  const handleOpenCopyToModal = useCallback(
    (optionId) => {
      const option = options.find((o) => (o.id || o.tempId) === optionId);
      if (!option) return;
      setCopyingOption(option);
      setSelectedTargetConfig(otherConfigurators[0]?.id?.toString() || "");
      setCopyToModalOpen(true);
    },
    [options, otherConfigurators]
  );

  const handleCopyOptionToConfig = useCallback(() => {
    if (!copyingOption || !selectedTargetConfig) return;

    const formData = new FormData();
    formData.append("actionType", "copyOptionTo");
    formData.append("optionData", JSON.stringify(copyingOption));
    formData.append("targetConfigId", selectedTargetConfig);
    submit(formData, { method: "post" });

    setCopyToModalOpen(false);
    setCopyingOption(null);
    
    const targetConfig = otherConfigurators.find((c) => c.id.toString() === selectedTargetConfig);
    shopify.toast.show(`Option in "${targetConfig?.title}" kopiert`);
  }, [copyingOption, selectedTargetConfig, submit, otherConfigurators, shopify]);

  // Move option in order (drag simulation via buttons)
  const moveOption = useCallback(
    (fromIndex, direction) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= orderedOptions.length) return;

      const newOrder = orderedOptions.map((o) => o.id || o.tempId);
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
      setOptionOrder(newOrder);
    },
    [orderedOptions]
  );

  // Track the last processed actionData reference
  const lastProcessedActionRef = useRef(null);

  // Keep refs to current state values so we can access them in the save effect
  const currentStateRef = useRef({});
  currentStateRef.current = {
    title, priceFormula, options, optionOrder,
    configurableProducts, virtualVariants, rules,
    activateSurcharges, formulaModeSurcharges, useVariantNameInFormula,
    useUnifiedSku, unifiedSku, minimumPrice, useMinimumPrice,
    basePrice, redirectToDifferentPage, redirectLink, templateSuffix,
  };

  // Handle successful save - update IDs and reset dirty state
  useEffect(() => {
    // Only process if this is a NEW actionData (different object reference)
    if (actionData?.success && actionData !== lastProcessedActionRef.current) {
      lastProcessedActionRef.current = actionData;
      
      const idMap = actionData.optionIdMap || {};
      // Use the saved snapshot from when save was initiated, not current state
      const state = savedStateSnapshotRef.current || currentStateRef.current;
      let updatedOptions = state.options;
      let updatedOptionOrder = state.optionOrder;

      if (Object.keys(idMap).length > 0) {
        // Calculate new options with real IDs
        updatedOptions = state.options.map((opt) => {
          const key = opt.id || opt.tempId;
          const realId = idMap[key];
          if (realId && realId !== opt.id) {
            const { tempId, ...rest } = opt;
            return { ...rest, id: realId };
          }
          return opt;
        });

        // Calculate new option order with real IDs
        updatedOptionOrder = state.optionOrder.map((id) => idMap[id] || id);

        // Update state with new IDs
        setOptions(updatedOptions);
        setOptionOrder(updatedOptionOrder);
      }

      // Reset dirty state with the saved snapshot values (including any ID updates)
      initialStateRef.current = normalizeForComparison({
        ...state,
        options: updatedOptions,
        optionOrder: updatedOptionOrder,
      });
      
      // Clear the saved snapshot
      savedStateSnapshotRef.current = null;
      
      // Increment saveVersion to force isDirty re-computation
      setSaveVersion((v) => v + 1);
      
      shopify.toast.show("Gespeichert");
      
      // Navigate if there's a pending navigation after save
      if (navigateAfterSaveRef.current) {
        let target = navigateAfterSaveRef.current;
        
        // Replace tempId with real ID in the navigation URL
        if (Object.keys(idMap).length > 0) {
          for (const [tempId, realId] of Object.entries(idMap)) {
            if (target.includes(`/option/${tempId}/`)) {
              target = target.replace(`/option/${tempId}/`, `/option/${realId}/`);
              break;
            }
          }
        }
        
        navigateAfterSaveRef.current = null;
        setIsSavingAndNavigating(false);
        setPendingOptionNavigation(null);
        navigate(target);
      }
    }
  }, [actionData, navigate]);

  // Before unload warning
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleBack = useCallback(() => {
    if (isDirty) {
      setUnsavedChangesModalOpen(true);
    } else {
      navigate("/app");
    }
  }, [isDirty, navigate]);

  const PRICE_MODE_LABELS = {
    "price-formula": { title: "Preisformel-Modus", tone: "info" },
    "variant-price": { title: "Variantenpreis-Modus", tone: "attention" },
    "info-only": { title: "Personalisierung ohne Preisänderung", tone: "success" },
  };

  return (
    <Page
      title={`Konfigurator: ${configuration?.title}`}
      titleMetadata={
        <Badge tone={PRICE_MODE_LABELS[priceMode]?.tone || "info"}>
          {PRICE_MODE_LABELS[priceMode]?.title || priceMode}
        </Badge>
      }
      backAction={{ content: "Zurück", onAction: handleBack }}
      primaryAction={{
        content: "Speichern",
        loading: isSaving,
        onAction: handleSave,
        disabled: !isDirty,
      }}
    >
      {isDirty && (
        <SaveBar id="vepo-save-bar">
          <button variant="primary" onClick={handleSave} loading={isSaving ? "" : undefined}>
            Speichern
          </button>
          <button onClick={handleDiscard}>Verwerfen</button>
        </SaveBar>
      )}

      {actionData?.errors && (
        <Layout.Section>
          <Banner tone="critical" title="Fehler beim Speichern">
            <BlockStack gap="100">
              {Object.entries(actionData.errors).map(([key, value]) => (
                <Text key={key} as="p">
                  {value}
                </Text>
              ))}
            </BlockStack>
          </Banner>
        </Layout.Section>
      )}

      <Layout>
        {/* Title */}
        <Layout.Section>
          <Card>
            <TextField
              label="Name des Konfigurators"
              value={title}
              onChange={setTitle}
              autoComplete="off"
              requiredIndicator
              error={actionData?.errors?.title}
            />
          </Card>
        </Layout.Section>

        {/* Products */}
        <Layout.Section>
          <ProductList
            products={configurableProducts}
            onAddProduct={handleAddProduct}
            onRemoveProduct={handleRemoveProduct}
            priceMode={priceMode}
          />
        </Layout.Section>

        {/* Theme Template Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">
                  Theme-Vorlage zuweisen (optional)
                </Text>
                <Text variant="bodyMd" tone="subdued">
                  Damit der Konfigurator auf deinen Produktseiten angezeigt wird, muss das Produkt eine Vorlage verwenden, die den Visionz Easy Product Options Block enthält.
                </Text>
              </BlockStack>

              <Select
                options={[
                  { label: "Nicht automatisch setzen (ich mache das manuell)", value: "" },
                  ...templates
                    .filter((t) => t.suffix) // Filter out templates with empty suffix
                    .map((t) => ({
                      label: t.name,
                      value: t.suffix,
                    })),
                ]}
                value={templateSuffix}
                onChange={setTemplateSuffix}
              />

              {!templateSuffix && (
                <Banner tone="warning">
                  <BlockStack gap="300">
                    <Text variant="bodyMd">
                      Noch keine eigene Produkt-Vorlage mit dem "Visionz Easy Product Options" Block erstellt?
                    </Text>
                    <InlineStack>
                      <Button
                        url={`https://${shop}/admin/themes/current/editor`}
                        target="_blank"
                      >
                        Theme Vorlage erstellen
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Banner>
              )}

              {templateSuffix && configurableProducts.length > 0 && (
                <Banner tone="success">
                  <p>
                    Beim Speichern {configurableProducts.length === 1 ? "wird" : "werden"} {configurableProducts.length} Produkt{configurableProducts.length !== 1 ? "e" : ""} automatisch auf die Vorlage "{templates.find(t => t.suffix === templateSuffix)?.name || templateSuffix}" gesetzt.
                  </p>
                </Banner>
              )}

              {!templateSuffix && configurableProducts.length > 0 && (
                <Text variant="bodySm" tone="caution">
                  Hinweis: Ohne automatische Vorlagen-Zuweisung musst du im Shopify Admin bei jedem Produkt manuell die richtige Vorlage auswählen.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Options List */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Optionen
                </Text>
                <Button onClick={() => setOptionPickerOpen(true)}>
                  Option hinzufügen
                </Button>
              </InlineStack>

              {orderedOptions.length === 0 ? (
                <Banner tone="info">
                  <p>Noch keine Optionen. Füge Optionen hinzu, aus denen deine Kunden wählen können.</p>
                </Banner>
              ) : (
                <BlockStack gap="200">
                  {orderedOptions.map((option, index) => {
                    const optionId = option.id || option.tempId;
                    const OptionIcon = OPTION_TYPE_ICONS[option.type] || ListBulletedIcon;

                    return (
                      <div
                        key={optionId}
                        style={{
                          border: "1px solid var(--p-color-border)",
                          borderRadius: "var(--p-border-radius-200)",
                          padding: "var(--p-space-300)",
                          cursor: "pointer",
                        }}
                        onClick={() => handleOptionClick(optionId)}
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            <InlineStack gap="100">
                              <Button
                                icon={ChevronUpIcon}
                                variant="plain"
                                size="slim"
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveOption(index, -1);
                                }}
                                accessibilityLabel="Nach oben"
                              />
                              <Button
                                icon={ChevronDownIcon}
                                variant="plain"
                                size="slim"
                                disabled={index === orderedOptions.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveOption(index, 1);
                                }}
                                accessibilityLabel="Nach unten"
                              />
                            </InlineStack>
                            <Icon source={OptionIcon} />
                            <BlockStack gap="0">
                              <Text variant="bodyMd" fontWeight="semibold">
                                {option.name || "Unbenannte Option"}
                              </Text>
                              <Text variant="bodySm" tone="subdued">
                                {OPTION_TYPE_LABELS[option.type] || option.type}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                          <InlineStack gap="100">
                            <Button
                              icon={DuplicateIcon}
                              variant="plain"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateOption(optionId);
                              }}
                              accessibilityLabel="Option duplizieren"
                            />
                            {otherConfigurators.length > 0 && (
                              <Button
                                icon={ExportIcon}
                                variant="plain"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenCopyToModal(optionId);
                                }}
                                accessibilityLabel="Option in anderen Konfigurator kopieren"
                              />
                            )}
                            <Button
                              icon={DeleteIcon}
                              variant="plain"
                              tone="critical"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOption(optionId);
                              }}
                              accessibilityLabel="Option entfernen"
                            />
                          </InlineStack>
                        </InlineStack>
                      </div>
                    );
                  })}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Price Formula Editor */}
        {priceMode === "price-formula" && (
          <Layout.Section>
            <PriceFormulaEditor
              formula={priceFormula}
              onChange={setPriceFormula}
              options={options}
              minimumPrice={minimumPrice}
              onMinimumPriceChange={setMinimumPrice}
              roundingEnabled={roundingEnabled}
              onRoundingEnabledChange={setRoundingEnabled}
              roundingPrecision={roundingPrecision}
              onRoundingPrecisionChange={setRoundingPrecision}
            />
          </Layout.Section>
        )}

        {/* Virtual Variants Table */}
        {priceMode === "variant-price" && (
          <Layout.Section>
            <VirtualVariantsTable
              virtualVariants={virtualVariants}
              onChange={setVirtualVariants}
              basePrice={basePrice}
              onBasePriceChange={setBasePrice}
              options={options}
            />
          </Layout.Section>
        )}

        {/* Rules */}
        <Layout.Section>
          <RulesEditor
            rules={rules}
            onChange={setRules}
            options={options}
          />
        </Layout.Section>

        {/* Advanced Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <div
                onClick={() => setAdvancedOpen(!advancedOpen)}
                style={{ cursor: "pointer" }}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">
                    Weitere Einstellungen
                  </Text>
                  <div style={{ marginLeft: "auto", marginRight: 0 }}>
                    <Icon source={advancedOpen ? ChevronUpIcon : ChevronDownIcon} />
                  </div>
                </InlineStack>
              </div>

              <Collapsible open={advancedOpen}>
                <BlockStack gap="300">
                  {(priceMode === "info-only" || priceMode === "default") && (
                    <Checkbox
                      label="Aufpreise aktivieren (Personalisierung ohne Preisänderung)"
                      checked={activateSurcharges}
                      onChange={setActivateSurcharges}
                    />
                  )}

                  {priceMode === "price-formula" && (
                    <Checkbox
                      label="Aufpreise zusätzlich zur Formel (Preisformel-Modus)"
                      checked={formulaModeSurcharges}
                      onChange={setFormulaModeSurcharges}
                    />
                  )}

                  <Divider />

                  <Checkbox
                    label="Einheitliche SKU für alle Varianten"
                    checked={useUnifiedSku}
                    onChange={setUseUnifiedSku}
                  />
                  {useUnifiedSku && (
                    <TextField
                      label="SKU"
                      value={unifiedSku}
                      onChange={setUnifiedSku}
                      autoComplete="off"
                    />
                  )}

                  <Divider />

                  <Checkbox
                    label="Nach dem Hinzufügen zum Warenkorb auf eine andere Seite weiterleiten"
                    checked={redirectToDifferentPage}
                    onChange={setRedirectToDifferentPage}
                  />
                  {redirectToDifferentPage && (
                    <TextField
                      label="Weiterleitungs-URL"
                      value={redirectLink}
                      onChange={setRedirectLink}
                      autoComplete="off"
                      placeholder="https://..."
                    />
                  )}
                </BlockStack>
              </Collapsible>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <OptionPicker
        open={optionPickerOpen}
        onClose={() => setOptionPickerOpen(false)}
        onSelect={handleAddOption}
        currentPriceMode={priceMode}
      />

      <Modal
        open={unsavedChangesModalOpen}
        onClose={() => setUnsavedChangesModalOpen(false)}
        title="Ungespeicherte Änderungen"
        primaryAction={{
          content: "Speichern",
          onAction: () => {
            handleSave();
            setUnsavedChangesModalOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: "Ohne Speichern verlassen",
            destructive: true,
            onAction: () => navigate("/app"),
          },
          {
            content: "Weiter bearbeiten",
            onAction: () => setUnsavedChangesModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Du hast ungespeicherte Änderungen. Wenn du jetzt zurückgehst, gehen diese verloren.
          </Text>
        </Modal.Section>
      </Modal>

      <Modal
        open={!!pendingOptionNavigation}
        onClose={() => {
          if (!isSavingAndNavigating) {
            setPendingOptionNavigation(null);
          }
        }}
        title="Ungespeicherte Änderungen"
        primaryAction={{
          content: isSavingAndNavigating ? "Wird gespeichert..." : "Speichern und fortfahren",
          loading: isSavingAndNavigating,
          onAction: () => {
            navigateAfterSaveRef.current = pendingOptionNavigation;
            setIsSavingAndNavigating(true);
            handleSave();
          },
        }}
        secondaryActions={isSavingAndNavigating ? [] : [
          {
            content: "Ohne Speichern fortfahren",
            destructive: true,
            onAction: () => {
              const target = pendingOptionNavigation;
              setPendingOptionNavigation(null);
              navigate(target);
            },
          },
          {
            content: "Abbrechen",
            onAction: () => setPendingOptionNavigation(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Du hast ungespeicherte Änderungen im Konfigurator. Wenn du zur Option navigierst, ohne zu speichern, gehen diese verloren.
          </Text>
        </Modal.Section>
      </Modal>

      <Modal
        open={copyToModalOpen}
        onClose={() => {
          setCopyToModalOpen(false);
          setCopyingOption(null);
        }}
        title="Option in anderen Konfigurator kopieren"
        primaryAction={{
          content: "Kopieren",
          onAction: handleCopyOptionToConfig,
          disabled: !selectedTargetConfig,
        }}
        secondaryActions={[
          {
            content: "Abbrechen",
            onAction: () => {
              setCopyToModalOpen(false);
              setCopyingOption(null);
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p">
              Option <Text as="span" fontWeight="bold">„{copyingOption?.name || "Unbenannt"}"</Text> wird in den ausgewählten Konfigurator kopiert.
            </Text>
            <Select
              label="Ziel-Konfigurator"
              options={otherConfigurators.map((c) => ({
                label: c.title,
                value: c.id.toString(),
              }))}
              value={selectedTargetConfig}
              onChange={setSelectedTargetConfig}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
