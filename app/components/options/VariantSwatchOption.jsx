import {
  BlockStack,
  TextField,
  Button,
  Text,
  InlineStack,
  Card,
  Icon,
  Badge,
} from "@shopify/polaris";
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon } from "@shopify/polaris-icons";
import { useCallback } from "react";
import { useTranslation } from "../../utils/i18n";

const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

export default function VariantSwatchOption({ option, onChange }) {
  const { t } = useTranslation();
  const values = Array.isArray(option.values) ? option.values : [];
  const hasExplicitDefault = values.some((v) => v.isDefault);

  const addValue = useCallback(() => {
    onChange({
      ...option,
      values: [...values, { id: "v_" + Date.now(), name: "", variantId: "", price: "0.00", surcharge: "0.00" }],
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
      <Text variant="headingSm" as="h4">
        {t("options.variantSwatch.variants")}
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
              <div style={{ flex: 1 }}>
                <TextField
                  label={t("common.name")}
                  value={value.name}
                  onChange={(val) => updateValue(index, "name", val)}
                  autoComplete="off"
                />
              </div>
              {option.hasAdditionalPrice && (
                <div style={{ width: "120px" }}>
                  <TextField
                    label={t("common.surcharge")}
                    type="number"
                    value={String(value.surcharge ?? "0.00")}
                    onChange={(val) => updateValue(index, "surcharge", val)}
                    onBlur={() => updateValue(index, "surcharge", formatPrice(value.surcharge))}
                    autoComplete="off"
                  />
                </div>
              )}
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

      <Button onClick={addValue}>{t("options.variantSwatch.addVariant")}</Button>
    </BlockStack>
  );
}
