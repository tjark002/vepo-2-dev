import { json } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useNavigation,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Button,
  IndexTable,
  Text,
  Badge,
  Modal,
  BlockStack,
  InlineStack,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import {
  DeleteIcon,
  DuplicateIcon,
  EditIcon,
} from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  vepoGetConfigurations,
  vepoDeleteConfiguration,
} from "../models/VepoConfigurator.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const configurations = await vepoGetConfigurations(session.shop, admin.graphql, true);

  return json({ configurations });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "delete") {
    const configId = parseInt(formData.get("configId"));
    const configTitle = formData.get("configTitle") || "";
    await vepoDeleteConfiguration(configId, configTitle, admin.graphql);
    return json({ success: true, action: "delete" });
  }

  if (actionType === "duplicate") {
    const configId = parseInt(formData.get("configId"));

    // Get the original configuration with all relations
    const original = await db.productConfigurationOptions.findUnique({
      where: { id: configId },
      include: {
        options: true,
        virtualVariants: true,
        rules: {
          include: {
            conditions: true,
          },
        },
      },
    });

    if (!original) {
      return json({ error: "Configuration not found" }, { status: 404 });
    }

    // Create new configuration (without products - they have unique constraint)
    const newConfig = await db.productConfigurationOptions.create({
      data: {
        title: original.title + " (Kopie)",
        shop: original.shop,
        priceFormula: original.priceFormula,
        priceMode: original.priceMode,
        activateSurcharges: original.activateSurcharges,
        formulaModeSurcharges: original.formulaModeSurcharges,
        useVariantNameInFormula: original.useVariantNameInFormula,
        useUnifiedSku: original.useUnifiedSku,
        unifiedSku: original.unifiedSku,
        minimumPrice: original.minimumPrice,
        useMinimumPrice: original.useMinimumPrice,
        basePrice: original.basePrice,
        redirectToDifferentPage: original.redirectToDifferentPage,
        redirectLink: original.redirectLink,
      },
    });

    // Duplicate options and build ID mapping
    const optionIdMap = {};
    const newOptionIds = [];

    for (const option of original.options) {
      const newOption = await db.option.create({
        data: {
          shop: option.shop,
          name: option.name,
          type: option.type,
          required: option.required,
          description: option.description,
          isMultiselect: option.isMultiselect,
          isPreselected: option.isPreselected,
          hasAdditionalPrice: option.hasAdditionalPrice,
          additionalPrice: option.additionalPrice,
          checkBoxLabel: option.checkBoxLabel,
          maxLength: option.maxLength,
          placeholder: option.placeholder,
          min: option.min,
          max: option.max,
          default: option.default,
          unit: option.unit,
          allowedFileTypes: option.allowedFileTypes,
          values: option.values,
          displayMode: option.displayMode,
          allowAllDates: option.allowAllDates,
          minDate: option.minDate,
          maxDate: option.maxDate,
          decimalPlaces: option.decimalPlaces,
          productConfigurations: {
            connect: { id: newConfig.id },
          },
        },
      });
      optionIdMap[option.id] = newOption.id;
      newOptionIds.push(newOption.id);
    }

    // Update option order with new IDs
    let optionOrder = [];
    try {
      const originalOrder = JSON.parse(original.optionOrder || "[]");
      optionOrder = originalOrder.map((id) => optionIdMap[id] || id);
    } catch {
      optionOrder = newOptionIds;
    }

    await db.productConfigurationOptions.update({
      where: { id: newConfig.id },
      data: { optionOrder: JSON.stringify(optionOrder) },
    });

    // Duplicate virtual variants
    for (const vv of original.virtualVariants) {
      await db.virtualProductVariant.create({
        data: {
          shop: vv.shop,
          variantHandle: vv.variantHandle,
          configurationId: newConfig.id,
          variantPrice: vv.variantPrice,
        },
      });
    }

    // Duplicate rules with condition mappings
    for (const rule of original.rules) {
      const newTargetOptionId = optionIdMap[rule.targetOptionId];
      if (!newTargetOptionId) continue;

      const newRule = await db.optionRule.create({
        data: {
          shop: rule.shop,
          configurationId: newConfig.id,
          show: rule.show,
          targetOptionId: newTargetOptionId,
          targetValueId: rule.targetValueId || null,
          priority: rule.priority || 0,
        },
      });

      for (const condition of rule.conditions) {
        const newConditionOptionId = optionIdMap[condition.optionId];
        if (!newConditionOptionId) continue;

        await db.condition.create({
          data: {
            shop: condition.shop,
            ruleId: newRule.id,
            optionId: newConditionOptionId,
            operator: condition.operator,
            value: condition.value,
          },
        });
      }
    }

    return json({ success: true, action: "duplicate", newId: newConfig.id });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

const PRICE_MODE_LABELS = {
  "price-formula": "Preisformel",
  "variant-price": "Variantenpreis",
  "info-only": "Personalisierung ohne Preisänderung",
  default: "Personalisierung ohne Preisänderung",
};

const PRICE_MODE_STATUS = {
  "price-formula": "info",
  "variant-price": "warning",
  "info-only": "success",
  default: "success",
};

export default function DashboardPage() {
  const { configurations } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [deleteModal, setDeleteModal] = useState({ open: false, config: null });

  const openDeleteModal = useCallback((config) => {
    setDeleteModal({ open: true, config });
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteModal({ open: false, config: null });
  }, []);

  const handleDelete = useCallback(() => {
    if (!deleteModal.config) return;
    const formData = new FormData();
    formData.append("actionType", "delete");
    formData.append("configId", deleteModal.config.id);
    formData.append("configTitle", deleteModal.config.title);
    submit(formData, { method: "post" });
    closeDeleteModal();
  }, [deleteModal, submit, closeDeleteModal]);

  const handleDuplicate = useCallback(
    (configId) => {
      const formData = new FormData();
      formData.append("actionType", "duplicate");
      formData.append("configId", configId);
      submit(formData, { method: "post" });
    },
    [submit]
  );

  const rowMarkup =
    configurations?.map((config, index) => {
      const productCount = config.configurableProducts?.length || 0;
      const optionCount = config.options?.length || 0;

      return (
        <IndexTable.Row
          id={config.id.toString()}
          key={config.id}
          position={index}
          onClick={() => navigate(`/app/configurator/${config.id}`)}
        >
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {config.title}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span">{productCount}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text as="span">{optionCount}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Badge
              tone={PRICE_MODE_STATUS[config.priceMode] || "info"}
            >
              {PRICE_MODE_LABELS[config.priceMode] || config.priceMode}
            </Badge>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <InlineStack gap="200">
              <Button
                icon={EditIcon}
                variant="plain"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/app/configurator/${config.id}`);
                }}
                accessibilityLabel="Bearbeiten"
              />
              <Button
                icon={DuplicateIcon}
                variant="plain"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicate(config.id);
                }}
                accessibilityLabel="Duplizieren"
              />
              <Button
                icon={DeleteIcon}
                variant="plain"
                tone="critical"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal(config);
                }}
                accessibilityLabel="Löschen"
              />
            </InlineStack>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }) || [];

  const emptyState = (
    <EmptyState
      heading="Noch keine Konfiguratoren"
      action={{
        content: "Ersten Konfigurator erstellen",
        onAction: () => navigate("/app/configurator/new"),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Erstelle einen Produktkonfigurator, um deinen Kunden personalisierbare
        Produkte anzubieten.
      </p>
    </EmptyState>
  );

  return (
    <Page
      title="Produktkonfiguratoren"
      primaryAction={{
        content: "Neuer Konfigurator",
        onAction: () => navigate("/app/configurator/new"),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {configurations && configurations.length > 0 ? (
              <IndexTable
                resourceName={{
                  singular: "Konfigurator",
                  plural: "Konfiguratoren",
                }}
                itemCount={configurations.length}
                headings={[
                  { title: "Name" },
                  { title: "Produkte" },
                  { title: "Optionen" },
                  { title: "Preis-Modus" },
                  { title: "Aktionen" },
                ]}
                selectable={false}
                loading={isLoading}
              >
                {rowMarkup}
              </IndexTable>
            ) : (
              emptyState
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={deleteModal.open}
        onClose={closeDeleteModal}
        title="Konfigurator löschen?"
        primaryAction={{
          content: "Endgültig löschen",
          destructive: true,
          onAction: handleDelete,
        }}
        secondaryActions={[
          {
            content: "Abbrechen",
            onAction: closeDeleteModal,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              Bist du sicher, dass du den Konfigurator{" "}
              <Text as="span" fontWeight="bold">
                "{deleteModal.config?.title}"
              </Text>{" "}
              löschen möchtest?
            </Text>
            <Banner tone="critical">
              <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
