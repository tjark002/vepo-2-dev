import {
  BlockStack,
  TextField,
  Select,
  Text,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { useMemo } from "react";
import { useTranslation } from "../../utils/i18n";

export default function DimensionOption({ option, onChange }) {
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

  const DECIMAL_OPTIONS = useMemo(() => [
    { label: t("options.dimension.noDecimals"), value: "0" },
    { label: t("options.dimension.oneDecimal"), value: "1" },
    { label: t("options.dimension.twoDecimals"), value: "2" },
    { label: t("options.dimension.threeDecimals"), value: "3" },
    { label: t("options.dimension.anyDecimals"), value: "-1" },
  ], [t]);
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>{t("options.dimension.bannerInfo", { name: option.name || "breite" })}</p>
      </Banner>

      <InlineStack gap="300" wrap>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label={t("options.dimension.minimum")}
            type="number"
            value={option.min != null ? String(option.min) : ""}
            onChange={(val) => update("min", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder={t("common.optional")}
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label={t("options.dimension.maximum")}
            type="number"
            value={option.max != null ? String(option.max) : ""}
            onChange={(val) => update("max", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder={t("common.optional")}
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <TextField
            label={t("common.defaultValue")}
            type="number"
            value={option.default != null ? String(option.default) : ""}
            onChange={(val) => update("default", val === "" ? null : parseFloat(val))}
            autoComplete="off"
            placeholder={t("common.optional")}
          />
        </div>
      </InlineStack>

      <InlineStack gap="300" wrap>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <Select
            label={t("common.unit")}
            options={UNITS}
            value={option.unit || "cm"}
            onChange={(val) => update("unit", val)}
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <Select
            label={t("options.dimension.decimalPlaces")}
            options={DECIMAL_OPTIONS}
            value={String(option.decimalPlaces ?? -1)}
            onChange={(val) => update("decimalPlaces", parseInt(val))}
          />
        </div>
      </InlineStack>
    </BlockStack>
  );
}
