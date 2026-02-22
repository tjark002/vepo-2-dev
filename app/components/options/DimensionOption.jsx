import {
  BlockStack,
  TextField,
  Select,
  Text,
  InlineStack,
  Banner,
} from "@shopify/polaris";

const UNITS = [
  { label: "cm", value: "cm" },
  { label: "mm", value: "mm" },
  { label: "m", value: "m" },
  { label: "Zoll", value: "in" },
  { label: "kg", value: "kg" },
  { label: "g", value: "g" },
  { label: "Stück", value: "pcs" },
  { label: "Liter", value: "l" },
  { label: "ml", value: "ml" },
];

const DECIMAL_OPTIONS = [
  { label: "Keine Dezimalstellen", value: "0" },
  { label: "1 Dezimalstelle", value: "1" },
  { label: "2 Dezimalstellen", value: "2" },
  { label: "3 Dezimalstellen", value: "3" },
  { label: "Beliebig", value: "-1" },
];

export default function DimensionOption({ option, onChange }) {
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>
          Maß-Optionen können in der Preisformel als Variable verwendet werden,
          z.B. <strong>[{option.name || "breite"}]</strong> * <strong>[höhe]</strong> * 0.5.
          Nur mit dem Preisformel-Modus verwendbar.
        </p>
      </Banner>

      <InlineStack gap="300" wrap>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label="Minimum"
            type="number"
            value={option.min != null ? String(option.min) : ""}
            onChange={(val) => update("min", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder="Optional"
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label="Maximum"
            type="number"
            value={option.max != null ? String(option.max) : ""}
            onChange={(val) => update("max", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder="Optional"
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label="Standardwert"
            type="number"
            value={option.default != null ? String(option.default) : ""}
            onChange={(val) => update("default", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder="Optional"
          />
        </div>
      </InlineStack>

      <InlineStack gap="300" wrap>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <Select
            label="Einheit"
            options={UNITS}
            value={option.unit || "cm"}
            onChange={(val) => update("unit", val)}
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <Select
            label="Dezimalstellen"
            options={DECIMAL_OPTIONS}
            value={String(option.decimalPlaces ?? -1)}
            onChange={(val) => update("decimalPlaces", parseInt(val))}
          />
        </div>
      </InlineStack>
    </BlockStack>
  );
}
