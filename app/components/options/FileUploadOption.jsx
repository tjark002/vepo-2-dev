import {
  BlockStack,
  TextField,
  Text,
} from "@shopify/polaris";
import { useTranslation } from "../../utils/i18n";

export default function FileUploadOption({ option, onChange }) {
  const { t } = useTranslation();
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <TextField
        label={t("options.fileUpload.allowedTypes")}
        value={option.allowedFileTypes || ""}
        onChange={(val) => update("allowedFileTypes", val)}
        autoComplete="off"
        helpText={t("options.fileUpload.allowedTypesHelp")}
        placeholder={t("options.fileUpload.allowedTypesPlaceholder")}
      />
    </BlockStack>
  );
}
