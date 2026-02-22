import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigate, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Text,
  Button,
  Badge,
  Banner,
  List,
  Divider,
  Icon,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// ============================================================================
// Price mode definitions with detailed descriptions
// ============================================================================

const PRICE_MODES = [
  {
    value: "price-formula",
    title: "Preisformel-Modus",
    subtitle: "Dynamische Preisberechnung mit Formeln",
    description:
      "Der Preis wird anhand einer Formel berechnet, die auf Maßen, Varianten und anderen Eingaben basiert. Ideal wenn der Preis von Kundeneingaben abhängt.",
    useCases: [
      "Produkte, deren Preis von Maßen abhängt (z.B. Rollos, Stoffe, Planen)",
      "Produkte mit flächen- oder volumenbasierter Preisberechnung",
    ],
    features: [
      "Formeleditor mit Variablen (Breite, Höhe, etc.)",
      "Optionale Aufpreise zusätzlich zur Formel",
      "Mindestpreise",
    ],
    limitations: [
      "Preis ist nicht manuell pro Variante einstellbar",
      "Deine Shopify Produktvarianten werden überschrieben",
    ],
  },
  {
    value: "variant-price",
    title: "Variantenpreis-Modus",
    subtitle: "Feste Preise pro Varianten-Kombination",
    description:
      "Jede mögliche Kombination aus Optionen erhält einen individuell festgelegten Preis. Ideal wenn du die volle Kontrolle über jeden Einzelpreis haben möchtest.",
    useCases: [
      "Du willst einfach mehr als 3 Variantenebenen anbieten",
      "Jede Variante soll einzeln bepreist werden können",
    ],
    features: [
      "Automatische Variantenerstellung für alle Kombinationen",
      "Basispreis + individuelle Anpassung pro Variante",
    ],
    limitations: [
      "Deine Shopify Produktvarianten werden überschrieben",
      "Keine Preisformeln möglich",
    ],
  },
  {
    value: "info-only",
    title: "Personalisierung ohne Preisänderung",
    subtitle: "Optionen ohne Einfluss auf den Preis",
    description:
      "Die Auswahl des Kunden wird als Eigenschaft an den Warenkorb übergeben, aber der Preis bleibt unverändert beim Original-Produktpreis. Ideal für reine Personalisierung.",
    useCases: [
      "Gravuren, Texte oder Initialen auf Produkten",
      "Farbwahl oder Materialwahl ohne Preisunterschied",
      "Geschenkverpackung oder Widmungen",
      "Terminwahl oder Datumsauswahl",
    ],
    features: [
      "Einfachste Konfiguration",
      "Keine Varianten-Erstellung nötig",
      "Originalpreis des Produkts bleibt erhalten",
    ],
    limitations: [
      "Kein dynamischer Preis basierend auf Auswahl",
      "Aufpreise sind nicht möglich",
    ],
  },
];

// ============================================================================
// Loader
// ============================================================================

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({});
};

// ============================================================================
// Action
// ============================================================================

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = (formData.get("title") || "").trim();
  const priceMode = formData.get("priceMode") || "";

  // Validate
  const errors = {};
  if (!title) {
    errors.title = "Bitte gib einen Namen für den Konfigurator ein.";
  }
  if (!["price-formula", "variant-price", "info-only"].includes(priceMode)) {
    errors.priceMode = "Bitte wähle einen Preis-Modus aus.";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: 422 });
  }

  // Create the configurator with just title + priceMode
  const newConfig = await db.productConfigurationOptions.create({
    data: {
      title,
      priceMode,
      shop: session.shop,
    },
  });

  // Server-side redirect to the new configurator
  return redirect(`/app/configurator/${newConfig.id}`);
};

// ============================================================================
// Component
// ============================================================================

export default function NewConfiguratorSetup() {
  const actionData = useActionData();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [title, setTitle] = useState("");
  const [selectedMode, setSelectedMode] = useState(null);

  const canContinue = title.trim().length > 0 && selectedMode !== null;

  return (
    <Page
      title="Neuer Konfigurator"
      backAction={{ content: "Zurück", onAction: () => navigate("/app") }}
    >
      {actionData?.errors && (
        <Layout.Section>
          <Banner tone="critical" title="Fehler">
            <BlockStack gap="100">
              {Object.entries(actionData.errors).map(([key, value]) => (
                <Text key={key} as="p">
                  {value}
                </Text>
              ))}
            </BlockStack>
          </Banner>
        </Layout.Section>
      )}

      <Layout>
        {/* Step 1: Name */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Schritt 1: Name vergeben
              </Text>
              <TextField
                label="Name des Konfigurators"
                value={title}
                onChange={setTitle}
                autoComplete="off"
                requiredIndicator
                placeholder="z.B. Rollo-Konfigurator, T-Shirt-Designer..."
                error={actionData?.errors?.title}
                helpText="Der Name hilft dir, den Konfigurator in der Übersicht zu identifizieren."
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Step 2: Price Mode */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">
                  Schritt 2: Preis-Modus wählen
                </Text>
                <Text variant="bodySm" tone="subdued">
                  Der Preis-Modus bestimmt, wie Preise für konfigurierte Produkte berechnet werden.
                  Diese Auswahl kann nachträglich nicht mehr geändert werden.
                </Text>
              </BlockStack>

              {actionData?.errors?.priceMode && (
                <Banner tone="critical">
                  <p>{actionData.errors.priceMode}</p>
                </Banner>
              )}

              <BlockStack gap="400">
                {PRICE_MODES.map((mode) => {
                  const isSelected = selectedMode === mode.value;

                  return (
                    <div
                      key={mode.value}
                      onClick={() => setSelectedMode(mode.value)}
                      style={{
                        cursor: "pointer",
                        border: isSelected
                          ? "2px solid var(--p-color-border-interactive)"
                          : "1px solid var(--p-color-border)",
                        borderRadius: "var(--p-border-radius-300)",
                        padding: "var(--p-space-500)",
                        backgroundColor: isSelected
                          ? "var(--p-color-bg-surface-selected)"
                          : "var(--p-color-bg-surface)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <BlockStack gap="300">
                        {/* Header */}
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              border: isSelected
                                ? "2px solid var(--p-color-border-interactive)"
                                : "2px solid var(--p-color-border)",
                              backgroundColor: isSelected ? "#ffffff" : "transparent",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isSelected && (
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M10 3L4.5 8.5L2 6"
                                  stroke="#637381"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <BlockStack gap="0">
                            <Text variant="headingSm" as="h3">
                              {mode.title}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {mode.subtitle}
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        <Divider />

                        {/* Details Grid */}
                        <InlineStack gap="400" wrap align="start">
                          {/* Use Cases */}
                          <div style={{ flex: "1 1 200px" }}>
                            <BlockStack gap="200">
                              <Text variant="headingXs" as="h4" tone="subdued">
                                Anwendungsfälle
                              </Text>
                              <List type="bullet">
                                {mode.useCases.map((item, i) => (
                                  <List.Item key={i}>{item}</List.Item>
                                ))}
                              </List>
                            </BlockStack>
                          </div>

                          {/* Features */}
                          <div style={{ flex: "1 1 200px" }}>
                            <BlockStack gap="200">
                              <Text variant="headingXs" as="h4" tone="success">
                                Features
                              </Text>
                              <List type="bullet">
                                {mode.features.map((item, i) => (
                                  <List.Item key={i}>{item}</List.Item>
                                ))}
                              </List>
                            </BlockStack>
                          </div>

                          {/* Limitations */}
                          <div style={{ flex: "1 1 200px" }}>
                            <BlockStack gap="200">
                              <Text variant="headingXs" as="h4" tone="caution">
                                Einschränkungen
                              </Text>
                              <List type="bullet">
                                {mode.limitations.map((item, i) => (
                                  <List.Item key={i}>{item}</List.Item>
                                ))}
                              </List>
                            </BlockStack>
                          </div>
                        </InlineStack>
                      </BlockStack>
                    </div>
                  );
                })}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Continue Button */}
        <Layout.Section>
          <InlineStack align="end">
            <Form method="post">
              <input type="hidden" name="title" value={title} />
              <input type="hidden" name="priceMode" value={selectedMode || ""} />
              <Button
                variant="primary"
                size="large"
                submit
                disabled={!canContinue}
                loading={isSubmitting}
              >
                Konfigurator erstellen & weiter
              </Button>
            </Form>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
