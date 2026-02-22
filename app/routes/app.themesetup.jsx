import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  List,
  Banner,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function ThemeSetupPage() {
  return (
    <Page title="Theme Setup">
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>
              Der Vepo Konfigurator wird als App Block in dein Theme eingebunden.
              Folge diesen Schritten, um ihn auf deinen Produktseiten zu
              aktivieren.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Schritt-für-Schritt Anleitung
              </Text>

              <List type="number">
                <List.Item>
                  <BlockStack gap="200">
                    <Text fontWeight="bold">Theme Editor öffnen</Text>
                    <Text tone="subdued">
                      Gehe in deinem Shopify Admin zu "Online Store" → "Themes"
                      → "Customize" (Anpassen).
                    </Text>
                  </BlockStack>
                </List.Item>

                <List.Item>
                  <BlockStack gap="200">
                    <Text fontWeight="bold">Produkt-Template auswählen</Text>
                    <Text tone="subdued">
                      Wähle oben im Theme Editor "Products" → "Default product"
                      (oder dein gewünschtes Produkt-Template).
                    </Text>
                  </BlockStack>
                </List.Item>

                <List.Item>
                  <BlockStack gap="200">
                    <Text fontWeight="bold">App Block hinzufügen</Text>
                    <Text tone="subdued">
                      Klicke auf "Add block" (Block hinzufügen) in der linken
                      Seitenleiste. Suche nach "Vepo Konfigurator" unter "Apps"
                      und füge ihn hinzu. Platziere den Block dort, wo der
                      Konfigurator erscheinen soll (z.B. unter der
                      Produktbeschreibung).
                    </Text>
                  </BlockStack>
                </List.Item>

                <List.Item>
                  <BlockStack gap="200">
                    <Text fontWeight="bold">Styling anpassen</Text>
                    <Text tone="subdued">
                      Klicke auf den "Vepo Konfigurator" Block, um seine
                      Einstellungen zu öffnen. Hier kannst du Farben,
                      Schriftgrößen, Abstände und mehr anpassen, damit der
                      Konfigurator zu deinem Theme passt.
                    </Text>
                  </BlockStack>
                </List.Item>

                <List.Item>
                  <BlockStack gap="200">
                    <Text fontWeight="bold">Speichern und testen</Text>
                    <Text tone="subdued">
                      Klicke oben rechts auf "Save" (Speichern). Öffne dann eine
                      Produktseite, die einem Konfigurator zugeordnet ist, um das
                      Ergebnis zu testen.
                    </Text>
                  </BlockStack>
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Wichtige Hinweise
              </Text>

              <List>
                <List.Item>
                  Der Konfigurator erscheint nur auf Produktseiten von Produkten,
                  die einem Konfigurator zugeordnet sind.
                </List.Item>
                <List.Item>
                  Im Preisformel- und Variantenpreis-Modus werden die
                  Standard-Varianten-Auswahl des Themes automatisch
                  ausgeblendet.
                </List.Item>
                <List.Item>
                  Die von der App erstellten Varianten sind für die
                  Preisberechnung notwendig und werden automatisch verwaltet.
                </List.Item>
                <List.Item>
                  Das Styling kann direkt in den Block-Einstellungen im Theme
                  Editor angepasst werden.
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Preismodi erklärt
              </Text>

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text fontWeight="bold">Preisformel-Modus (Empfohlen)</Text>
                  <Text tone="subdued">
                    Ideal für Produkte mit variablen Maßen. Der Preis wird
                    dynamisch anhand einer Formel berechnet (z.B. Breite × Höhe ×
                    Preis pro m²). Die App erstellt dafür automatisch Varianten
                    im Hintergrund.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="100">
                  <Text fontWeight="bold">Variantenpreis-Modus</Text>
                  <Text tone="subdued">
                    Für feste Preise pro Kombination. Du definierst Preise für
                    jede mögliche Varianten-Kombination. Gut geeignet, wenn du
                    einen festen Katalog an Optionen und Preisen hast.
                  </Text>
                </BlockStack>

                <Divider />

                <BlockStack gap="100">
                  <Text fontWeight="bold">Personalisierung ohne Preisänderung</Text>
                  <Text tone="subdued">
                    Die einfachste Variante. Optionen werden nur als
                    Eigenschaften an den Warenkorb übergeben. Der Preis bleibt
                    der Original-Produktpreis. Ideal für Personalisierungen ohne
                    Preisänderung.
                  </Text>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
