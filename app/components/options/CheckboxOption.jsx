import {
  BlockStack,
  TextField,
  Text,
} from "@shopify/polaris";

export default function CheckboxOption({ option, onChange }) {
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <TextField
        label="Checkbox-Label"
        value={option.checkBoxLabel || ""}
        onChange={(val) => update("checkBoxLabel", val)}
        autoComplete="off"
        helpText="Text, der neben der Checkbox angezeigt wird"
      />
    </BlockStack>
  );
}
