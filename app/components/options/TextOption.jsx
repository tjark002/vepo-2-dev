import {
  BlockStack,
  TextField,
  Text,
  Banner,
} from "@shopify/polaris";

export default function TextOption({ option, onChange }) {
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>
          Der eingegebene Text wird als Eigenschaft an den Warenkorb übergeben,
          z.B. für Gravuren oder Personalisierungen.
        </p>
      </Banner>

      <TextField
        label="Placeholder"
        value={option.placeholder || ""}
        onChange={(val) => update("placeholder", val)}
        autoComplete="off"
        helpText="Text, der angezeigt wird, wenn das Feld leer ist"
      />

      <TextField
        label="Maximale Zeichenanzahl"
        type="number"
        value={String(option.maxLength || 0)}
        onChange={(val) => update("maxLength", parseInt(val) || 0)}
        autoComplete="off"
        helpText="0 = unbegrenzt"
      />
    </BlockStack>
  );
}
