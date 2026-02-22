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

export default function ProductList({
  products,
  onAddProduct,
  onRemoveProduct,
  priceMode,
}) {
  const showVariantWarning = priceMode === "price-formula" || priceMode === "variant-price";

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Zugeordnete Produkte
          </Text>
          <Button onClick={onAddProduct}>Produkt hinzufügen</Button>
        </InlineStack>

        <Text variant="bodySm" tone="subdued">
          Diese Produkte zeigen den Konfigurator auf ihrer Produktseite. (Sofern der Konfigurator-Block im Theme eingebunden ist.)
        </Text>

        {showVariantWarning && (
          <Banner tone="warning">
            <p>
              <strong>Achtung:</strong> Beim Speichern werden die bestehenden Shopify-Produktvarianten des Originalprodukts überschrieben.
            </p>
          </Banner>
        )}

        {products.length === 0 ? (
          <Banner tone="info">
            <p>Noch keine Produkte zugeordnet. Füge Produkte hinzu, für die dieser Konfigurator gelten soll.</p>
          </Banner>
        ) : (
          <ResourceList
            resourceName={{ singular: "Produkt", plural: "Produkte" }}
            items={products}
            renderItem={(product) => (
              <ResourceItem
                id={product.productId}
                media={
                  product.productImage ? (
                    <Thumbnail
                      source={product.productImage}
                      alt={product.productAlt || product.productTitle || "Produkt"}
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
                      {product.productTitle || "Laden..."}
                    </Text>
                    {product.productDeleted && (
                      <Text variant="bodySm" tone="critical">
                        Produkt wurde gelöscht
                      </Text>
                    )}
                  </BlockStack>
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    tone="critical"
                    onClick={() => onRemoveProduct(product.productId)}
                    accessibilityLabel="Produkt entfernen"
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
