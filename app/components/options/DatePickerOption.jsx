import {
  BlockStack,
  TextField,
  Text,
  Checkbox,
  InlineStack,
  Banner,
} from "@shopify/polaris";

export default function DatePickerOption({ option, onChange }) {
  const update = (field, value) => {
    onChange({ ...option, [field]: value });
  };

  return (
    <BlockStack gap="400">
      <Checkbox
        label="Alle Daten erlauben"
        checked={option.allowAllDates !== false}
        onChange={(val) => update("allowAllDates", val)}
        helpText="Wenn aktiviert, können Kunden jedes Datum wählen"
      />

      {!option.allowAllDates && (
        <Banner tone="info">
          <p>Lege die Grenzen fest, in denen Kunden ein Datum wählen können.</p>
        </Banner>
      )}

      {!option.allowAllDates && (
        <InlineStack gap="300" wrap>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <TextField
              label="Frühestes Datum"
              type="date"
              value={option.minDate || ""}
              onChange={(val) => update("minDate", val)}
              autoComplete="off"
            />
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <TextField
              label="Spätestes Datum"
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
