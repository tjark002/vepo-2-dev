import { useMemo } from "react";
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
import { useTranslation } from "../utils/i18n";

const DIMENSION_OPTIONS = [
  { type: "dimension", icon: HashtagIcon, compatibleModes: ["price-formula"] },
  { type: "dimensionselect", icon: HashtagIcon, compatibleModes: ["price-formula"] },
];

const SELECTION_OPTIONS = [
  { type: "variantswatch", icon: ListBulletedIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "dropdown", icon: SelectIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "colorswatch", icon: ColorIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "imageswatch", icon: ImageIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
];

const USER_INPUT_OPTIONS = [
  { type: "text", icon: TextFontIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "checkbox", icon: CheckboxIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "date", icon: CalendarIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
  { type: "file", icon: AttachmentIcon, compatibleModes: ["price-formula", "variant-price", "info-only"] },
];

const DESC_KEYS = {
  dimension: "dimensionDesc",
  dimensionselect: "dimensionSelectDesc",
  variantswatch: "variantSwatchDesc",
  dropdown: "dropdownDesc",
  colorswatch: "colorSwatchDesc",
  imageswatch: "imageSwatchDesc",
  text: "textDesc",
  checkbox: "checkboxDesc",
  date: "dateDesc",
  file: "fileDesc",
};

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
  const { t } = useTranslation();
  const showDimensionSection = currentPriceMode === "price-formula";

  const addLabels = (opts) =>
    opts.map((o) => ({
      ...o,
      label: t(`optionTypes.${o.type}`),
      description: t(`optionPicker.${DESC_KEYS[o.type]}`),
    }));

  const dimensionOptions = useMemo(() => addLabels(DIMENSION_OPTIONS), [t]);
  const selectionOptions = useMemo(() => addLabels(SELECTION_OPTIONS), [t]);
  const userInputOptions = useMemo(() => addLabels(USER_INPUT_OPTIONS), [t]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("optionPicker.title")}
      large
    >
      <Modal.Section>
        <BlockStack gap="500">
          {showDimensionSection && (
            <>
              <OptionSection
                title={t("optionPicker.dimensionSection")}
                options={dimensionOptions}
                currentPriceMode={currentPriceMode}
                onSelect={onSelect}
                onClose={onClose}
              />
              <Divider />
            </>
          )}

          <OptionSection
            title={t("optionPicker.selectionSection")}
            options={selectionOptions}
            currentPriceMode={currentPriceMode}
            onSelect={onSelect}
            onClose={onClose}
          />

          <Divider />

          <OptionSection
            title={t("optionPicker.userInputSection")}
            options={userInputOptions}
            currentPriceMode={currentPriceMode}
            onSelect={onSelect}
            onClose={onClose}
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
