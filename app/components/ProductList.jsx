import {
  Card,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Banner,
  Icon,
} from "@shopify/polaris";
import { DeleteIcon, ImageIcon } from "@shopify/polaris-icons";
import { useTranslation } from "../utils/i18n";

export default function ProductList({
  products,
  onAddProduct,
  onRemoveProduct,
  priceMode,
}) {
  const { t } = useTranslation();
  const showVariantWarning = priceMode === "price-formula" || priceMode === "variant-price";

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">
            {t("productList.title")}
          </Text>
          <Button onClick={onAddProduct}>{t("productList.addProduct")}</Button>
        </InlineStack>

        <Text variant="bodySm" tone="subdued">
          {t("productList.description")}
        </Text>

        {showVariantWarning && (
          <Banner tone="warning">
            <p>{t("productList.variantWarning")}</p>
          </Banner>
        )}

        {products.length === 0 ? (
          <Banner tone="info">
            <p>{t("productList.noProducts")}</p>
          </Banner>
        ) : (
          <ResourceList
            resourceName={{ singular: t("common.product"), plural: t("common.products") }}
            items={products}
            renderItem={(product) => (
              <ResourceItem
                id={product.productId}
                media={
                  product.productImage ? (
                    <Thumbnail
                      source={product.productImage}
                      alt={product.productAlt || product.productTitle || t("common.product")}
                      size="small"
                    />
                  ) : (
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        backgroundColor: "var(--p-color-bg-surface-secondary)",
                        borderRadius: "var(--p-border-radius-100)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon source={ImageIcon} tone="subdued" />
                    </div>
                  )
                }
                accessibilityLabel={product.productTitle}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="semibold">
                      {product.productTitle || t("common.loading")}
                    </Text>
                    {product.productDeleted && (
                      <Text variant="bodySm" tone="critical">
                        {t("productList.productDeleted")}
                      </Text>
                    )}
                  </BlockStack>
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={() => onRemoveProduct(product.productId)}
                    accessibilityLabel={t("productList.removeProduct")}
                  />
                </InlineStack>
              </ResourceItem>
            )}
          />
        )}
      </BlockStack>
    </Card>
  );
}
