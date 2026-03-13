import {
  BlockStack,
  TextField,
  Text,
  Checkbox,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { useTranslation } from "../../utils/i18n";

export default function DatePickerOption({ option, onChange }) {
  const { t } = useTranslation();
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Checkbox
        label={t("options.datePicker.allowAllDates")}
        checked={option.allowAllDates !== false}
        onChange={(val) => update("allowAllDates", val)}
        helpText={t("options.datePicker.allowAllDatesHelp")}
      />

      {!option.allowAllDates && (
        <Banner tone="info">
          <p>{t("options.datePicker.dateRangeInfo")}</p>
        </Banner>
      )}

      {!option.allowAllDates && (
        <InlineStack gap="300" wrap>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <TextField
              label={t("options.datePicker.minDate")}
              type="date"
              value={option.minDate || ""}
              onChange={(val) => update("minDate", val)}
              autoComplete="off"
            />
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <TextField
              label={t("options.datePicker.maxDate")}
              type="date"
              value={option.maxDate || ""}
              onChange={(val) => update("maxDate", val)}
              autoComplete="off"
            />
          </div>
        </InlineStack>
      )}
    </BlockStack>
  );
}
