import {
  BlockStack,
  TextField,
  Button,
  Text,
  InlineStack,
  Card,
  Select,
  Banner,
  Badge,
} from "@shopify/polaris";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon } from "@shopify/polaris-icons";
import { useCallback } from "react";

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

export default function DimensionSelectOption({ option, onChange }) {
  const values = Array.isArray(option.values) ? option.values : [];
  const hasExplicitDefault = values.some((v) => v.isDefault);

  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  const addValue = useCallback(() => {
    onChange({
      ...option,
      values: [...values, { id: "v_" + Date.now(), name: "", numericValue: "" }],
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

  const setAsDefault = useCallback(
    (index) => {
      const newValues = values.map((v, i) => ({ ...v, isDefault: i === index }));
      onChange({ ...option, values: newValues });
    },
    [option, values, onChange]
  );

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>
          Maß-Auswahl zeigt feste numerische Werte als klickbare Kacheln an.
          Der ausgewählte Wert kann in der Preisformel als <strong>[{option.name || "optionsname"}]</strong> verwendet werden.
        </p>
      </Banner>

      <Select
        label="Einheit"
        options={UNITS}
        value={option.unit || "cm"}
        onChange={(val) => update("unit", val)}
        helpText="Die Einheit wird hinter jedem Wert angezeigt"
      />

      <Text variant="headingSm" as="h4">
        Werte
      </Text>

      {values.map((value, index) => {
        const isEffectiveDefault = value.isDefault || (!hasExplicitDefault && index === 0);
        return (
          <Card key={index}>
            <InlineStack gap="200" blockAlign="start" wrap>
              <InlineStack gap="100">
                <Button icon={ChevronUpIcon} variant="plain" size="slim" disabled={index === 0} onClick={() => moveValue(index, -1)} />
                <Button icon={ChevronDownIcon} variant="plain" size="slim" disabled={index === values.length - 1} onClick={() => moveValue(index, 1)} />
              </InlineStack>
              <div style={{ flex: 1, minWidth: "100px" }}>
                <TextField
                  label="Anzeigetext"
                  value={value.name}
                  onChange={(val) => updateValue(index, "name", val)}
                  autoComplete="off"
                  placeholder="z.B. Klein, Mittel, Groß"
                  helpText="Optional - wenn leer, wird der Wert mit Einheit angezeigt"
                />
              </div>
              <div style={{ width: "120px" }}>
                <TextField
                  label="Wert"
                  type="number"
                  value={String(value.numericValue || "")}
                  onChange={(val) => updateValue(index, "numericValue", val)}
                  autoComplete="off"
                  placeholder="z.B. 50"
                  requiredIndicator
                />
              </div>
              {option.isPreselected && (
                <button
                  type="button"
                  onClick={() => setAsDefault(index)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  title={isEffectiveDefault ? "Standardwert" : "Als Standardwert setzen"}
                >
                  <Badge tone={isEffectiveDefault ? "success" : undefined}>Standard</Badge>
                </button>
              )}
              <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={() => removeValue(index)} />
            </InlineStack>
          </Card>
        );
      })}

      <Button onClick={addValue}>Wert hinzufügen</Button>
    </BlockStack>
  );
}
