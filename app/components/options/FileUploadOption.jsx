import {
  BlockStack,
  TextField,
  Text,
} from "@shopify/polaris";

export default function FileUploadOption({ option, onChange }) {
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <TextField
        label="Erlaubte Dateitypen"
        value={option.allowedFileTypes || ""}
        onChange={(val) => update("allowedFileTypes", val)}
        autoComplete="off"
        helpText="Komma-getrennt, z.B.: .jpg,.png,.pdf - Leer lassen für alle Dateitypen"
        placeholder=".jpg,.png,.pdf"
      />
    </BlockStack>
  );
}
