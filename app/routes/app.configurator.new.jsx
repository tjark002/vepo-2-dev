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
import { useState, useMemo } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useTranslation } from "../utils/i18n";

// Price mode definitions moved inside component for i18n support

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
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [selectedMode, setSelectedMode] = useState(null);

  const PRICE_MODES = useMemo(() => [
    {
      value: "price-formula",
      title: t("configuratorNew.priceFormulaTitle"),
      subtitle: t("configuratorNew.priceFormulaSubtitle"),
      description: t("configuratorNew.priceFormulaDesc"),
      useCases: [
        t("configuratorNew.pf_useCase1"),
        t("configuratorNew.pf_useCase2"),
      ],
      features: [
        t("configuratorNew.pf_feature1"),
        t("configuratorNew.pf_feature2"),
        t("configuratorNew.pf_feature3"),
      ],
      limitations: [
        t("configuratorNew.pf_limit1"),
        t("configuratorNew.pf_limit2"),
      ],
    },
    {
      value: "variant-price",
      title: t("configuratorNew.variantPriceTitle"),
      subtitle: t("configuratorNew.variantPriceSubtitle"),
      description: t("configuratorNew.variantPriceDesc"),
      useCases: [
        t("configuratorNew.vp_useCase1"),
        t("configuratorNew.vp_useCase2"),
      ],
      features: [
        t("configuratorNew.vp_feature1"),
        t("configuratorNew.vp_feature2"),
      ],
      limitations: [
        t("configuratorNew.vp_limit1"),
        t("configuratorNew.vp_limit2"),
      ],
    },
    {
      value: "info-only",
      title: t("configuratorNew.infoOnlyTitle"),
      subtitle: t("configuratorNew.infoOnlySubtitle"),
      description: t("configuratorNew.infoOnlyDesc"),
      useCases: [
        t("configuratorNew.io_useCase1"),
        t("configuratorNew.io_useCase2"),
        t("configuratorNew.io_useCase3"),
        t("configuratorNew.io_useCase4"),
      ],
      features: [
        t("configuratorNew.io_feature1"),
        t("configuratorNew.io_feature2"),
        t("configuratorNew.io_feature3"),
      ],
      limitations: [
        t("configuratorNew.io_limit1"),
        t("configuratorNew.io_limit2"),
      ],
    },
  ], [t]);

  const canContinue = title.trim().length > 0 && selectedMode !== null;

  return (
    <Page
      title={t("configuratorNew.pageTitle")}
      backAction={{ content: t("common.back"), onAction: () => navigate("/app") }}
    >
      {actionData?.errors && (
        <Layout.Section>
          <Banner tone="critical" title={t("common.error")}>
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
                {t("configuratorNew.step1")}
              </Text>
              <TextField
                label={t("configuratorNew.step1Name")}
                value={title}
                onChange={setTitle}
                autoComplete="off"
                requiredIndicator
                placeholder={t("configuratorNew.step1Placeholder")}
                error={actionData?.errors?.title}
                helpText={t("configuratorNew.step1Help")}
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
                  {t("configuratorNew.step2")}
                </Text>
                <Text variant="bodySm" tone="subdued">
                  {t("configuratorNew.step2Desc")}
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
                                {t("configuratorNew.useCases")}
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
                                {t("configuratorNew.features")}
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
                                {t("configuratorNew.limitations")}
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
                {t("configuratorNew.createButton")}
              </Button>
            </Form>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
