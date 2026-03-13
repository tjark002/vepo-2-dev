import {
  BlockStack,
  TextField,
  Text,
} from "@shopify/polaris";
import { useTranslation } from "../../utils/i18n";

export default function CheckboxOption({ option, onChange }) {
  const { t } = useTranslation();
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <TextField
        label={t("options.checkbox.label")}
        value={option.checkBoxLabel || ""}
        onChange={(val) => update("checkBoxLabel", val)}
        autoComplete="off"
        helpText={t("options.checkbox.labelHelp")}
      />
    </BlockStack>
  );
}
