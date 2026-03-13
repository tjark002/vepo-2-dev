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
import { useCallback, useMemo } from "react";
import { useTranslation } from "../../utils/i18n";

export default function DimensionSelectOption({ option, onChange }) {
  const { t } = useTranslation();

  const UNITS = useMemo(() => [
    { label: "cm", value: "cm" },
    { label: "mm", value: "mm" },
    { label: "m", value: "m" },
    { label: t("units.inch"), value: "in" },
    { label: "kg", value: "kg" },
    { label: "g", value: "g" },
    { label: t("units.pieces"), value: "pcs" },
    { label: t("units.liters"), value: "l" },
    { label: "ml", value: "ml" },
  ], [t]);
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
        <p>{t("options.dimensionSelect.bannerInfo", { name: option.name || "optionsname" })}</p>
      </Banner>

      <Select
        label={t("common.unit")}
        options={UNITS}
        value={option.unit || "cm"}
        onChange={(val) => update("unit", val)}
        helpText={t("options.dimensionSelect.unitHelp")}
      />

      <Text variant="headingSm" as="h4">
        {t("common.values")}
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
                  label={t("options.dimensionSelect.displayText")}
                  value={value.name}
                  onChange={(val) => updateValue(index, "name", val)}
                  autoComplete="off"
                  placeholder={t("options.dimensionSelect.displayTextPlaceholder")}
                  helpText={t("options.dimensionSelect.displayTextHelp")}
                />
              </div>
              <div style={{ width: "120px" }}>
                <TextField
                  label={t("common.value")}
                  type="number"
                  value={String(value.numericValue || "")}
                  onChange={(val) => updateValue(index, "numericValue", val)}
                  autoComplete="off"
                  placeholder={t("options.dimensionSelect.valuePlaceholder")}
                  requiredIndicator
                />
              </div>
              {option.isPreselected && (
                <button
                  type="button"
                  onClick={() => setAsDefault(index)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  title={isEffectiveDefault ? t("common.defaultValue") : t("common.setAsDefault")}
                >
                  <Badge tone={isEffectiveDefault ? "success" : undefined}>{t("common.standard")}</Badge>
                </button>
              )}
              <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={() => removeValue(index)} />
            </InlineStack>
          </Card>
        );
      })}

      <Button onClick={addValue}>{t("options.dimensionSelect.addValue")}</Button>
    </BlockStack>
  );
}
