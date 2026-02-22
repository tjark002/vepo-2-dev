import {
  BlockStack,
  TextField,
  Button,
  Text,
  InlineStack,
  Card,
  Thumbnail,
} from "@shopify/polaris";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon, ImageIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import ShopifyFilePicker from "../ShopifyFilePicker";

const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

export default function ImageSwatchOption({ option, onChange }) {
  const values = Array.isArray(option.values) ? option.values : [];
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const addValue = useCallback(() => {
    onChange({
      ...option,
      values: [...values, { name: "", imageUrl: "", surcharge: "0.00" }],
    });
  }, [option, values, onChange]);

  const removeValue = useCallback(
    (index) => {
      const newValues = values.filter((_, i) => i !== index);
      onChange({ ...option, values: newValues });
    },
    [option, values, onChange]
  );

  const updateValue = useCallback(
    (index, field, val) => {
      const newValues = [...values];
      newValues[index] = { ...newValues[index], [field]: val };
      onChange({ ...option, values: newValues });
    },
    [option, values, onChange]
  );

  const moveValue = useCallback(
    (index, direction) => {
      const newValues = [...values];
      const target = index + direction;
      if (target < 0 || target >= newValues.length) return;
      [newValues[index], newValues[target]] = [newValues[target], newValues[index]];
      onChange({ ...option, values: newValues });
    },
    [option, values, onChange]
  );

  const openFilePicker = useCallback((index) => {
    setEditingIndex(index);
    setFilePickerOpen(true);
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (editingIndex !== null) {
      const newValues = [...values];
      newValues[editingIndex] = {
        ...newValues[editingIndex],
        imageUrl: file.url,
        name: newValues[editingIndex].name || file.alt || "",
      };
      onChange({ ...option, values: newValues });
    }
    setFilePickerOpen(false);
    setEditingIndex(null);
  }, [editingIndex, values, option, onChange]);

  return (
    <BlockStack gap="400">
      <Text variant="headingSm" as="h4">
        Bildoptionen
      </Text>

      {values.map((value, index) => (
        <Card key={index}>
          <InlineStack gap="300" blockAlign="center" wrap>
            <InlineStack gap="100">
              <Button icon={ChevronUpIcon} variant="plain" size="slim" disabled={index === 0} onClick={() => moveValue(index, -1)} accessibilityLabel="Nach oben" />
              <Button icon={ChevronDownIcon} variant="plain" size="slim" disabled={index === values.length - 1} onClick={() => moveValue(index, 1)} accessibilityLabel="Nach unten" />
            </InlineStack>
            
            <button
              type="button"
              onClick={() => openFilePicker(index)}
              style={{
                width: "80px",
                height: "80px",
                border: value.imageUrl ? "none" : "2px dashed var(--p-color-border)",
                borderRadius: "8px",
                background: value.imageUrl ? "transparent" : "var(--p-color-bg-surface-secondary)",
                cursor: "pointer",
                padding: 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              title="Bild aus Shopify-Dateien wählen"
            >
              {value.imageUrl ? (
                <img
                  src={value.imageUrl}
                  alt={value.name || "Bild"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span style={{ color: "var(--p-color-icon-secondary)" }}>
                  <ImageIcon width={24} height={24} />
                </span>
              )}
            </button>

            <BlockStack gap="200" style={{ flex: 1, minWidth: "150px", gap: "10px" }}>
              <TextField
                label="Variantenname"
                value={value.name}
                onChange={(val) => updateValue(index, "name", val)}
                autoComplete="off"
              />
              <InlineStack gap="200" blockAlign="end">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Bild-URL"
                    value={value.imageUrl}
                    onChange={(val) => updateValue(index, "imageUrl", val)}
                    autoComplete="off"
                    placeholder="https://cdn.shopify.com/..."
                  />
                </div>
              </InlineStack>
            </BlockStack>
            
            {option.hasAdditionalPrice && (
              <div style={{ width: "120px" }}>
                <TextField
                  label="Aufpreis (€)"
                  type="number"
                  value={String(value.surcharge ?? "0.00")}
                  onChange={(val) => updateValue(index, "surcharge", val)}
                  onBlur={() => updateValue(index, "surcharge", formatPrice(value.surcharge))}
                  autoComplete="off"
                />
              </div>
            )}
            <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={() => removeValue(index)} accessibilityLabel="Löschen" />
          </InlineStack>
        </Card>
      ))}

      <Button onClick={addValue}>Bild hinzufügen</Button>

      <ShopifyFilePicker
        open={filePickerOpen}
        onClose={() => {
          setFilePickerOpen(false);
          setEditingIndex(null);
        }}
        onSelect={handleFileSelect}
      />
    </BlockStack>
  );
}
