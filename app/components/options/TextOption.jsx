import {
  BlockStack,
  TextField,
  Text,
  Banner,
} from "@shopify/polaris";
import { useTranslation } from "../../utils/i18n";

export default function TextOption({ option, onChange }) {
  const { t } = useTranslation();
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>{t("options.text.bannerInfo")}</p>
      </Banner>

      <TextField
        label={t("options.text.placeholder")}
        value={option.placeholder || ""}
        onChange={(val) => update("placeholder", val)}
        autoComplete="off"
        helpText={t("options.text.placeholderHelp")}
      />

      <TextField
        label={t("options.text.maxLength")}
        type="number"
        value={String(option.maxLength || 0)}
        onChange={(val) => update("maxLength", parseInt(val) || 0)}
        autoComplete="off"
        helpText={t("options.text.maxLengthHelp")}
      />
    </BlockStack>
  );
}
