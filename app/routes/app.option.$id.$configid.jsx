import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Text,
  Checkbox,
  Select,
  Banner,
  InlineStack,
  Badge,
  Icon,
  Modal,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import {
  ColorIcon,
  ImageIcon,
  TextFontIcon,
  HashtagIcon,
  CheckboxIcon as CheckboxPolarisIcon,
  CalendarIcon,
  AttachmentIcon,
  ListBulletedIcon,
  SelectIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

import VariantSwatchOption from "../components/options/VariantSwatchOption";
import ColorSwatchOption from "../components/options/ColorSwatchOption";
import ImageSwatchOption from "../components/options/ImageSwatchOption";
import DimensionOption from "../components/options/DimensionOption";
import DimensionSelectOption from "../components/options/DimensionSelectOption";
import TextOption from "../components/options/TextOption";
import CheckboxOption from "../components/options/CheckboxOption";
import DatePickerOption from "../components/options/DatePickerOption";
import FileUploadOption from "../components/options/FileUploadOption";

// Format price: remove leading zeros, ensure 2 decimal places
const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

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
  checkbox: CheckboxPolarisIcon,
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

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id, configid } = params;
  const url = new URL(request.url);
  const priceModeFromUrl = url.searchParams.get("priceMode") || "";

  // Load priceMode from the configuration
  let priceMode = priceModeFromUrl;
  if (configid && configid !== "new") {
    try {
      const config = await db.productConfigurationOptions.findUnique({
        where: { id: parseInt(configid) },
        select: { priceMode: true },
      });
      if (config) priceMode = config.priceMode;
    } catch {
      // fallback to URL param
    }
  }

  // If the ID starts with "opt_", it's a new unsaved option
  if (id.startsWith("opt_")) {
    const type = url.searchParams.get("type") || "text";
    return json({
      option: { type },
      configId: configid,
      isNew: true,
      optionTempId: id,
      priceMode,
    });
  }

  const option = await db.option.findUnique({
    where: { id: parseInt(id) },
  });

  if (!option) {
    throw new Response("Option not found", { status: 404 });
  }

  // Parse values JSON
  let values = [];
  try {
    values = option.values ? JSON.parse(option.values) : [];
  } catch {
    values = [];
  }

  // Format surcharge values on load
  values = values.map((v) => ({
    ...v,
    surcharge: v.surcharge !== undefined ? parseFloat(v.surcharge || 0).toFixed(2) : "0.00",
  }));

  // Format additionalPrice on load
  const formattedAdditionalPrice = parseFloat(option.additionalPrice || 0).toFixed(2);

  return json({
    option: { ...option, values, additionalPrice: parseFloat(formattedAdditionalPrice) },
    configId: configid,
    isNew: false,
    priceMode,
  });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const { configid } = params;

  const data = {
    name: formData.get("name"),
    type: formData.get("type"),
    required: formData.get("required") === "true",
    description: formData.get("description") || "",
    isMultiselect: formData.get("isMultiselect") === "true",
    isPreselected: formData.get("isPreselected") === "true",
    hasAdditionalPrice: formData.get("hasAdditionalPrice") === "true",
    additionalPrice: parseFloat(formData.get("additionalPrice")) || 0,
    checkBoxLabel: formData.get("checkBoxLabel") || "",
    maxLength: parseInt(formData.get("maxLength")) || 0,
    placeholder: formData.get("placeholder") || "",
    min: parseFloatOrNull(formData.get("min")),
    max: parseFloatOrNull(formData.get("max")),
    default: parseFloatOrNull(formData.get("default")),
    unit: formData.get("unit") || "",
    allowedFileTypes: formData.get("allowedFileTypes") || "",
    values: formData.get("values") || "[]",
    displayMode: formData.get("displayMode") || "",
    allowAllDates: formData.get("allowAllDates") !== "false",
    minDate: formData.get("minDate") || "",
    maxDate: formData.get("maxDate") || "",
    decimalPlaces: parseInt(formData.get("decimalPlaces") ?? "-1"),
  };

  if (!data.name) {
    return json({ errors: { name: "Name ist erforderlich" } }, { status: 422 });
  }

  const optionId = params.id;
  const configIdInt = parseInt(configid);

  if (isNaN(configIdInt)) {
    return json(
      { errors: { config: "Ungültige Konfigurator-ID. Bitte gehe zurück und versuche es erneut." } },
      { status: 422 }
    );
  }

  if (optionId.startsWith("opt_") || isNaN(parseInt(optionId))) {
    // Create new option
    const newOption = await db.option.create({
      data: {
        shop: session.shop,
        ...data,
        productConfigurations: {
          connect: { id: configIdInt },
        },
      },
    });

    // Update option order
    const config = await db.productConfigurationOptions.findUnique({
      where: { id: configIdInt },
      include: { options: true, virtualVariants: true },
    });
    let optionOrder = [];
    try {
      optionOrder = JSON.parse(config?.optionOrder || "[]");
    } catch {
      optionOrder = [];
    }
    // Replace temp ID with new ID
    optionOrder = optionOrder.map((id) => (id === optionId ? newOption.id : id));
    if (!optionOrder.includes(newOption.id)) {
      optionOrder.push(newOption.id);
    }
    await db.productConfigurationOptions.update({
      where: { id: configIdInt },
      data: { optionOrder: JSON.stringify(optionOrder) },
    });

    // In variant-price mode: regenerate virtual variants when a new selection option is created
    const selectionTypes = ["variantswatch", "dropdown", "colorswatch", "imageswatch"];
    if (config && config.priceMode === "variant-price" && selectionTypes.includes(data.type)) {
      // Re-fetch options including the newly created one
      const allOptions = await db.option.findMany({
        where: { productConfigurations: { some: { id: configIdInt } } },
      });
      const swatchOptions = allOptions.filter((o) => selectionTypes.includes(o.type));

      const optionValues = swatchOptions.map((o) => {
        let values = [];
        try {
          values = o.values ? JSON.parse(o.values) : [];
        } catch {
          values = [];
        }
        return values.map((v) => ({
          name: v.name || v.label || v.value || "Unbekannt",
          surcharge: parseFloat(v.surcharge) || 0,
        }));
      });

      if (swatchOptions.length > 0 && optionValues.every((v) => v.length > 0)) {
        const cartesian = (...arrays) =>
          arrays.reduce(
            (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
            [[]]
          );

        const combinations = cartesian(...optionValues);
        const basePrice = config.basePrice || 0;

        const existingMap = {};
        for (const v of (config.virtualVariants || [])) {
          existingMap[v.variantHandle] = v;
        }

        await db.virtualProductVariant.deleteMany({ where: { configurationId: configIdInt } });

        for (const combo of combinations) {
          const handle = combo.map((c) => c.name).join(" / ");
          const totalSurcharge = combo.reduce((sum, c) => sum + c.surcharge, 0);
          const calculatedPrice = Math.round((basePrice + totalSurcharge) * 100) / 100;

          const existing = existingMap[handle];
          const useManualPrice = existing && existing.manualPrice;

          await db.virtualProductVariant.create({
            data: {
              shop: session.shop,
              variantHandle: handle,
              configurationId: configIdInt,
              variantPrice: useManualPrice ? existing.variantPrice : calculatedPrice,
              manualPrice: useManualPrice || false,
            },
          });
        }
      }
    }

    // Redirect to the newly created option's edit page
    return redirect(`/app/option/${newOption.id}/${configid}`);
  }

  // Update existing option
  await db.option.update({
    where: { id: parseInt(optionId) },
    data,
  });

  // In variant-price mode: regenerate virtual variants when a selection option is saved
  const selectionTypes = ["variantswatch", "dropdown", "colorswatch", "imageswatch"];
  if (selectionTypes.includes(data.type)) {
    const config = await db.productConfigurationOptions.findUnique({
      where: { id: configIdInt },
      include: { options: true, virtualVariants: true },
    });

    if (config && config.priceMode === "variant-price") {
      const swatchOptions = config.options.filter((o) => selectionTypes.includes(o.type));

      // Parse values for each swatch option
      const optionValues = swatchOptions.map((o) => {
        let values = [];
        try {
          values = o.values ? JSON.parse(o.values) : [];
        } catch {
          values = [];
        }
        return values.map((v) => ({
          name: v.name || v.label || v.value || "Unbekannt",
          surcharge: parseFloat(v.surcharge) || 0,
        }));
      });

      // Only regenerate if all swatch options have values
      if (swatchOptions.length > 0 && optionValues.every((v) => v.length > 0)) {
        // Cartesian product
        const cartesian = (...arrays) =>
          arrays.reduce(
            (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
            [[]]
          );

        const combinations = cartesian(...optionValues);
        const basePrice = config.basePrice || 0;

        // Build lookup from existing variants (preserve manual prices)
        const existingMap = {};
        for (const v of config.virtualVariants) {
          existingMap[v.variantHandle] = v;
        }

        // Delete old virtual variants
        await db.virtualProductVariant.deleteMany({ where: { configurationId: configIdInt } });

        // Create new virtual variants
        for (const combo of combinations) {
          const handle = combo.map((c) => c.name).join(" / ");
          const totalSurcharge = combo.reduce((sum, c) => sum + c.surcharge, 0);
          const calculatedPrice = Math.round((basePrice + totalSurcharge) * 100) / 100;

          const existing = existingMap[handle];
          const useManualPrice = existing && existing.manualPrice;

          await db.virtualProductVariant.create({
            data: {
              shop: session.shop,
              variantHandle: handle,
              configurationId: configIdInt,
              variantPrice: useManualPrice ? existing.variantPrice : calculatedPrice,
              manualPrice: useManualPrice || false,
            },
          });
        }
      }
    }
  }

  return json({ success: true });
};

export default function OptionEditor() {
  const { option, configId, isNew, optionTempId, priceMode } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const shopify = useAppBridge();

  const [formState, setFormState] = useState(() => ({
    name: option?.name || "",
    type: option?.type || "text",
    required: option?.required || false,
    description: option?.description || "",
    isMultiselect: option?.isMultiselect || false,
    isPreselected: option?.isPreselected || false,
    hasAdditionalPrice: option?.hasAdditionalPrice || false,
    additionalPrice: option?.additionalPrice || 0,
    checkBoxLabel: option?.checkBoxLabel || "",
    maxLength: option?.maxLength || 0,
    placeholder: option?.placeholder || "",
    min: option?.min ?? 0,
    max: option?.max ?? 0,
    default: option?.default ?? 0,
    unit: option?.unit || "cm",
    allowedFileTypes: option?.allowedFileTypes || "",
    values: option?.values || [],
    displayMode: option?.displayMode || "",
    allowAllDates: option?.allowAllDates !== false,
    minDate: option?.minDate || "",
    maxDate: option?.maxDate || "",
    decimalPlaces: option?.decimalPlaces ?? -1,
  }));

  const initialStateRef = useRef(JSON.stringify(formState));
  const [saveVersion, setSaveVersion] = useState(0);
  
  // Track the option ID to detect when we've navigated to a different option (e.g. after save redirect)
  const optionIdRef = useRef(option?.id);
  
  // Reset state when option ID changes (e.g. after creating a new option and redirecting)
  useEffect(() => {
    if (option?.id !== optionIdRef.current) {
      optionIdRef.current = option?.id;
      const newState = {
        name: option?.name || "",
        type: option?.type || "text",
        required: option?.required || false,
        description: option?.description || "",
        isMultiselect: option?.isMultiselect || false,
        isPreselected: option?.isPreselected || false,
        hasAdditionalPrice: option?.hasAdditionalPrice || false,
        additionalPrice: option?.additionalPrice || 0,
        checkBoxLabel: option?.checkBoxLabel || "",
        maxLength: option?.maxLength || 0,
        placeholder: option?.placeholder || "",
        min: option?.min ?? null,
        max: option?.max ?? null,
        default: option?.default ?? null,
        unit: option?.unit || "cm",
        allowedFileTypes: option?.allowedFileTypes || "",
        values: option?.values || [],
        displayMode: option?.displayMode || "",
        allowAllDates: option?.allowAllDates !== false,
        minDate: option?.minDate || "",
        maxDate: option?.maxDate || "",
        decimalPlaces: option?.decimalPlaces ?? -1,
      };
      setFormState(newState);
      initialStateRef.current = JSON.stringify(newState);
      setSaveVersion((v) => v + 1);
    }
  }, [option]);
  
  const isDirty = useMemo(
    () => JSON.stringify(formState) !== initialStateRef.current,
    [formState, saveVersion] // saveVersion forces re-computation after save
  );

  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);

  const updateField = useCallback((field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateOption = useCallback((updatedOption) => {
    setFormState((prev) => ({ ...prev, ...updatedOption }));
  }, []);

  const handleDiscard = useCallback(() => {
    navigate(`/app/configurator/${configId}`);
  }, [navigate, configId]);

  // Track the last processed actionData reference and the state that was saved
  const lastProcessedActionRef = useRef(null);
  const savedStateRef = useRef(null);

  // Capture state when save is initiated so we track the correct "clean" state
  const handleSave = useCallback(() => {
    savedStateRef.current = JSON.stringify(formState);
    const formData = new FormData();
    Object.entries(formState).forEach(([key, value]) => {
      if (key === "values") {
        formData.append(key, JSON.stringify(value));
      } else if (value === null || value === undefined) {
        formData.append(key, "");
      } else {
        formData.append(key, String(value));
      }
    });
    submit(formData, { method: "post" });
  }, [formState, submit]);

  useEffect(() => {
    if (actionData?.success && actionData !== lastProcessedActionRef.current) {
      lastProcessedActionRef.current = actionData;
      // Use the captured state from when save was initiated, not current formState
      if (savedStateRef.current) {
        initialStateRef.current = savedStateRef.current;
        savedStateRef.current = null;
      }
      setSaveVersion((v) => v + 1); // Force isDirty re-computation
      shopify.toast.show("Option gespeichert");
    }
  }, [actionData]);

  const OptionIcon = OPTION_TYPE_ICONS[formState.type] || ListBulletedIcon;

  // Render type-specific component
  const renderTypeSpecific = () => {
    switch (formState.type) {
      case "variantswatch":
      case "dropdown":
        return <VariantSwatchOption option={formState} onChange={updateOption} />;
      case "colorswatch":
        return <ColorSwatchOption option={formState} onChange={updateOption} />;
      case "imageswatch":
        return <ImageSwatchOption option={formState} onChange={updateOption} />;
      case "dimension":
        return <DimensionOption option={formState} onChange={updateOption} />;
      case "dimensionselect":
        return <DimensionSelectOption option={formState} onChange={updateOption} />;
      case "text":
        return <TextOption option={formState} onChange={updateOption} />;
      case "checkbox":
        return <CheckboxOption option={formState} onChange={updateOption} />;
      case "date":
        return <DatePickerOption option={formState} onChange={updateOption} />;
      case "file":
        return <FileUploadOption option={formState} onChange={updateOption} />;
      default:
        return null;
    }
  };

  const configPath = configId === "new" ? "/app" : `/app/configurator/${configId}`;

  const handleBack = useCallback(() => {
    // Bei neuen Optionen: immer warnen wenn etwas eingegeben wurde
    // Bei bestehenden: nur warnen wenn isDirty
    const hasUnsavedChanges = isNew ? (formState.name.trim() !== "" || formState.values.length > 0) : isDirty;
    if (hasUnsavedChanges) {
      setUnsavedChangesModalOpen(true);
    } else {
      navigate(configPath);
    }
  }, [isDirty, isNew, formState.name, formState.values, navigate, configPath]);

  return (
    <Page
      title={isNew ? "Neue Option" : `Option: ${option?.name || ""}`}
      backAction={{
        content: "Zurück zum Konfigurator",
        onAction: handleBack,
      }}
      primaryAction={{
        content: "Speichern",
        loading: isSaving,
        onAction: handleSave,
        disabled: !isDirty && !isNew,
      }}
    >
      {isDirty && (
        <SaveBar id="vepo-option-save-bar">
          <button variant="primary" onClick={handleSave} loading={isSaving ? "" : undefined}>
            Speichern
          </button>
          <button onClick={handleDiscard}>Verwerfen</button>
        </SaveBar>
      )}

      {actionData?.errors && (
        <Layout.Section>
          <Banner tone="critical" title="Fehler">
            <BlockStack gap="100">
              {Object.entries(actionData.errors).map(([key, value]) => (
                <Text key={key} as="p">{value}</Text>
              ))}
            </BlockStack>
          </Banner>
        </Layout.Section>
      )}

      <Layout>
        {/* General settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ margin: 0, display: 'flex' }}><Icon source={OptionIcon} /></span>
                <Badge>{OPTION_TYPE_LABELS[formState.type] || formState.type}</Badge>
              </div>

              <TextField
                label="Name"
                value={formState.name}
                onChange={(val) => updateField("name", val)}
                autoComplete="off"
                requiredIndicator
                error={actionData?.errors?.name}
                helpText="Dieser Name wird auch als Variablenname in Preisformeln verwendet"
              />

              <TextField
                label="Beschreibung"
                value={formState.description}
                onChange={(val) => updateField("description", val)}
                autoComplete="off"
                multiline={2}
                helpText="Wird unter dem Optionsnamen auf der Produktseite angezeigt"
              />

              {/* Im Variantenmodus sind Auswahl-Optionen immer Pflicht, immer vorausgewählt, nie Mehrfachauswahl */}
              {priceMode === "variant-price" && ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(formState.type) ? (
                <Banner tone="info">
                  <p>Im Variantenpreis-Modus ist jede Auswahl-Option automatisch ein Pflichtfeld, hat die erste Option vorausgewählt und erlaubt keine Mehrfachauswahl.</p>
                </Banner>
              ) : (
                <>
                  <Checkbox
                    label="Pflichtfeld"
                    checked={formState.required}
                    onChange={(val) => updateField("required", val)}
                  />

                  {["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(formState.type) && (
                    <>
                      <Checkbox
                        label="Mehrfachauswahl erlauben"
                        checked={formState.isMultiselect}
                        onChange={(val) => updateField("isMultiselect", val)}
                      />
                      <Checkbox
                        label="Erste Option vorauswählen"
                        checked={formState.isPreselected}
                        onChange={(val) => updateField("isPreselected", val)}
                      />
                    </>
                  )}
                </>
              )}

              {/* Im Modus "Personalisierung ohne Preisänderung" (info-only) keine Aufpreise erlauben */}
              {priceMode !== "info-only" && (
                <>
                  <Checkbox
                    label={
                      ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(formState.type)
                        ? "Aufpreise pro Auswahl aktivieren"
                        : "Hat einen Aufpreis"
                    }
                    helpText={
                      ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(formState.type)
                        ? "Einzelne Auswahlwerte können unterschiedliche Aufpreise erhalten"
                        : undefined
                    }
                    checked={formState.hasAdditionalPrice}
                    onChange={(val) => updateField("hasAdditionalPrice", val)}
                  />

                  {formState.hasAdditionalPrice && !["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(formState.type) && (
                    <TextField
                      label="Aufpreis (€)"
                      type="number"
                      value={String(formState.additionalPrice ?? "0.00")}
                      onChange={(val) => updateField("additionalPrice", parseFloat(val) || 0)}
                      onBlur={() => updateField("additionalPrice", parseFloat(formatPrice(formState.additionalPrice)) || 0)}
                      autoComplete="off"
                    />
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Type-specific settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Typ-Einstellungen
              </Text>
              {renderTypeSpecific()}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

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
            onAction: () => navigate(configPath),
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
    </Page>
  );
}
