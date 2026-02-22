import {
  Modal,
  BlockStack,
  InlineGrid,
  Card,
  Text,
  Icon,
  Divider,
  Box,
} from "@shopify/polaris";
import {
  ColorIcon,
  ImageIcon,
  TextFontIcon,
  HashtagIcon,
  CheckboxIcon,
  CalendarIcon,
  AttachmentIcon,
  ListBulletedIcon,
  SelectIcon,
} from "@shopify/polaris-icons";

// Kategorie 1: Maßeingaben (nur im Preisformelmodus)
const DIMENSION_OPTIONS = [
  {
    type: "dimension",
    label: "Maßeingabe",
    description: "Numerische Maßeingabe (Breite, Höhe, etc.)",
    icon: HashtagIcon,
    compatibleModes: ["price-formula"],
  },
  {
    type: "dimensionselect",
    label: "Maß-Auswahl",
    description: "Feste numerische Werte als Kacheln (z.B. 50, 60, 70 cm)",
    icon: HashtagIcon,
    compatibleModes: ["price-formula"],
  },
];

// Kategorie 2: Auswahl-Optionen
const SELECTION_OPTIONS = [
  {
    type: "variantswatch",
    label: "Klassische Textkacheln",
    description: "Auswahl als klickbare Kacheln",
    icon: ListBulletedIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "dropdown",
    label: "Dropdown-Auswahl",
    description: "Auswahl als Dropdown-Menü",
    icon: SelectIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "colorswatch",
    label: "Farbkacheln",
    description: "Farbauswahl mit Farb-Swatches",
    icon: ColorIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "imageswatch",
    label: "Bildkacheln",
    description: "Auswahl mit Bild-Vorschau",
    icon: ImageIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
];

// Kategorie 3: Nutzereingaben
const USER_INPUT_OPTIONS = [
  {
    type: "text",
    label: "Texteingabe",
    description: "Freitextfeld für Gravuren, Personalisierungen, etc.",
    icon: TextFontIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "checkbox",
    label: "Einzelne Checkbox",
    description: "Ja/Nein Auswahl, z.B. für AGB-Zustimmung",
    icon: CheckboxIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "date",
    label: "Datum Eingabe",
    description: "Datumsauswahl mit optionalen Grenzen",
    icon: CalendarIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
  {
    type: "file",
    label: "Datei",
    description: "Datei-Upload mit Typ-Beschränkung",
    icon: AttachmentIcon,
    compatibleModes: ["price-formula", "variant-price", "info-only"],
  },
];

function OptionCard({ optionType, isCompatible, onSelect, onClose }) {
  return (
    <div
      onClick={() => {
        if (isCompatible) {
          onSelect(optionType.type);
          onClose();
        }
      }}
      style={{
        cursor: isCompatible ? "pointer" : "not-allowed",
        opacity: isCompatible ? 1 : 0.5,
      }}
    >
      <Card>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--p-space-200)", minHeight: "72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--p-space-200)" }}>
            <Icon source={optionType.icon} />
            <Text variant="bodyMd" fontWeight="bold">
              {optionType.label}
            </Text>
          </div>
          <Text variant="bodySm" tone="subdued">
            {optionType.description}
          </Text>
        </div>
      </Card>
    </div>
  );
}

function OptionSection({ title, options, currentPriceMode, onSelect, onClose }) {
  return (
    <BlockStack gap="300">
      <Text variant="headingMd" as="h3">
        {title}
      </Text>
      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
        {options.map((optionType) => {
          const isCompatible = optionType.compatibleModes.includes(currentPriceMode);
          return (
            <OptionCard
              key={optionType.type}
              optionType={optionType}
              isCompatible={isCompatible}
              onSelect={onSelect}
              onClose={onClose}
            />
          );
        })}
      </InlineGrid>
    </BlockStack>
  );
}

export default function OptionPicker({ open, onClose, onSelect, currentPriceMode }) {
  const showDimensionSection = currentPriceMode === "price-formula";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Optionstyp wählen"
      large
    >
      <Modal.Section>
        <BlockStack gap="500">
          {/* Kategorie 1: Maßeingaben - nur im Preisformelmodus */}
          {showDimensionSection && (
            <>
              <OptionSection
                title="Maßeingaben"
                options={DIMENSION_OPTIONS}
                currentPriceMode={currentPriceMode}
                onSelect={onSelect}
                onClose={onClose}
              />
              <Divider />
            </>
          )}

          {/* Kategorie 2: Auswahl-Optionen */}
          <OptionSection
            title="Auswahl-Optionen"
            options={SELECTION_OPTIONS}
            currentPriceMode={currentPriceMode}
            onSelect={onSelect}
            onClose={onClose}
          />

          <Divider />

          {/* Kategorie 3: Nutzereingaben */}
          <OptionSection
            title="Nutzereingaben"
            options={USER_INPUT_OPTIONS}
            currentPriceMode={currentPriceMode}
            onSelect={onSelect}
            onClose={onClose}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
