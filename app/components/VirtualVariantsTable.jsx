import {
  Card,
  BlockStack,
  DataTable,
  TextField,
  Text,
  Button,
  InlineStack,
  Banner,
  Badge,
  Icon,
  Tooltip,
} from "@shopify/polaris";
import { LockIcon, RefreshIcon } from "@shopify/polaris-icons";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// Format price: remove leading zeros, ensure 2 decimal places
const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

export default function VirtualVariantsTable({
  virtualVariants,
  onChange,
  basePrice,
  onBasePriceChange,
  options,
}) {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("ascending");
  const prevOptionsRef = useRef(null);

  // Generate variants from swatch options (variant, color, image)
  const swatchOptions = useMemo(
    () => options.filter((o) => ["variantswatch", "dropdown", "colorswatch", "imageswatch"].includes(o.type)),
    [options]
  );

  // Calculate the total surcharge for a given combination
  const calculateSurchargeForCombo = useCallback((combo, swatchOpts) => {
    let surcharge = 0;
    for (let i = 0; i < swatchOpts.length; i++) {
      const opt = swatchOpts[i];
      if (!opt.hasAdditionalPrice) continue;

      let values = [];
      try {
        const parsed = typeof opt.values === "string" ? JSON.parse(opt.values) : opt.values;
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = [];
      }

      const selectedName = combo[i];
      const matchedValue = values.find(
        (v) => (v.name || v.label || v.value) === selectedName
      );
      if (matchedValue && matchedValue.surcharge) {
        surcharge += parseFloat(matchedValue.surcharge) || 0;
      }
    }
    return surcharge;
  }, []);

  // Generate variants with surcharges baked into the price
  const generateVariants = useCallback(
    (existingVariants = []) => {
      if (swatchOptions.length === 0) return [];

      const optionValues = swatchOptions.map((o) => {
        let values = [];
        try {
          const parsed = typeof o.values === "string" ? JSON.parse(o.values) : o.values;
          values = Array.isArray(parsed) ? parsed : [];
        } catch {
          values = [];
        }
        return values.map((v) => ({
          name: v.name || v.label || v.value || "Unbekannt",
          surcharge: parseFloat(v.surcharge) || 0,
        }));
      });

      if (optionValues.some((v) => v.length === 0)) return existingVariants;

      // Generate cartesian product
      const cartesian = (...arrays) =>
        arrays.reduce(
          (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
          [[]]
        );

      const combinations = cartesian(...optionValues);
      const base = parseFloat(basePrice) || 0;

      // Build a lookup map from existing variants (to preserve manual prices)
      const existingMap = {};
      for (const v of existingVariants) {
        existingMap[v.variantHandle] = v;
      }

      const newVariants = combinations.map((combo) => {
        const handle = combo.map((c) => c.name).join(" / ");
        const totalSurcharge = combo.reduce((sum, c) => sum + c.surcharge, 0);
        const calculatedPrice = Math.round((base + totalSurcharge) * 100) / 100;

        const existing = existingMap[handle];
        if (existing && existing.manualPrice) {
          // Preserve manually set price, store calculated for reference (transient)
          return {
            variantHandle: handle,
            variantPrice: existing.variantPrice,
            manualPrice: true,
            _calculatedPrice: calculatedPrice, // transient, not saved to DB
          };
        }

        return {
          variantHandle: handle,
          variantPrice: calculatedPrice,
          manualPrice: false,
          _calculatedPrice: calculatedPrice,
        };
      });

      return newVariants;
    },
    [swatchOptions, basePrice]
  );

  // Auto-generate when options change (new values, surcharges, etc.)
  useEffect(() => {
    const currentOptionsKey = JSON.stringify(
      swatchOptions.map((o) => ({
        id: o.id || o.tempId,
        values: o.values,
        hasAdditionalPrice: o.hasAdditionalPrice,
      }))
    );

    if (prevOptionsRef.current !== null && prevOptionsRef.current !== currentOptionsKey) {
      // Options changed – regenerate variants
      const regenerated = generateVariants(virtualVariants);
      if (regenerated.length > 0) {
        onChange(regenerated);
      }
    }
    prevOptionsRef.current = currentOptionsKey;
  }, [swatchOptions, generateVariants]); // intentionally exclude virtualVariants/onChange to avoid loops

  // Handle manual price change – set manualPrice flag
  const handlePriceChange = useCallback(
    (handle, newPrice) => {
      const updated = virtualVariants.map((v) => {
        if (v.variantHandle !== handle) return v;
        const price = parseFloat(newPrice) || 0;
        return {
          ...v,
          variantPrice: price,
          manualPrice: price !== (v._calculatedPrice ?? v.variantPrice),
        };
      });
      onChange(updated);
    },
    [virtualVariants, onChange]
  );

  // Reset a single variant to calculated price
  const handleResetPrice = useCallback(
    (handle) => {
      const updated = virtualVariants.map((v) => {
        if (v.variantHandle !== handle) return v;
        return {
          ...v,
          variantPrice: v._calculatedPrice ?? v.variantPrice,
          manualPrice: false,
        };
      });
      onChange(updated);
    },
    [virtualVariants, onChange]
  );

  // Force regenerate all (including manual ones)
  const handleForceRegenerate = useCallback(() => {
    // Clear all manual flags first
    const cleared = virtualVariants.map((v) => ({ ...v, manualPrice: false }));
    const regenerated = generateVariants(cleared);
    if (regenerated.length > 0) {
      onChange(regenerated);
    }
  }, [virtualVariants, generateVariants, onChange]);

  // Initial generation when switching to variant-price mode
  const handleGenerate = useCallback(() => {
    const regenerated = generateVariants(virtualVariants);
    if (regenerated.length > 0) {
      onChange(regenerated);
    }
  }, [generateVariants, virtualVariants, onChange]);

  const handleSort = useCallback(
    (headingIndex, direction) => {
      setSortColumn(headingIndex);
      setSortDirection(direction);
    },
    []
  );

  // Sort variants
  let displayVariants = [...virtualVariants];
  if (sortColumn !== null) {
    displayVariants.sort((a, b) => {
      if (sortColumn === 0) {
        return sortDirection === "ascending"
          ? a.variantHandle.localeCompare(b.variantHandle)
          : b.variantHandle.localeCompare(a.variantHandle);
      }
      if (sortColumn === 1) {
        return sortDirection === "ascending"
          ? a.variantPrice - b.variantPrice
          : b.variantPrice - a.variantPrice;
      }
      return 0;
    });
  }

  const manualCount = virtualVariants.filter((v) => v.manualPrice).length;

  // Check which swatch options have no values yet
  const emptySwatchOptions = useMemo(() => {
    return swatchOptions.filter((o) => {
      let values = [];
      try {
        const parsed = typeof o.values === "string" ? JSON.parse(o.values) : o.values;
        values = Array.isArray(parsed) ? parsed : [];
      } catch {
        values = [];
      }
      return values.length === 0;
    });
  }, [swatchOptions]);

  const OPTION_TYPE_LABELS = {
    variantswatch: "Klassische Textkacheln",
    dropdown: "Dropdown-Auswahl",
    colorswatch: "Farbkacheln",
    imageswatch: "Bildkacheln",
  };

  const rows = displayVariants.map((variant) => [
    <InlineStack key={variant.variantHandle + "-name"} gap="200" blockAlign="center" wrap={false}>
      <Text as="span">{variant.variantHandle}</Text>
      {variant.manualPrice && (
        <Tooltip content="Manuell angepasst – wird bei automatischen Neu-Berechnungen nicht überschrieben">
          <Badge tone="attention" size="small">
            <InlineStack gap="100" blockAlign="center">
              <Icon source={LockIcon} />
              <span>Manueller Preis</span>
            </InlineStack>
          </Badge>
        </Tooltip>
      )}
    </InlineStack>,
    <InlineStack key={variant.variantHandle + "-price"} gap="200" blockAlign="center" wrap={false} align="end">
      {variant.manualPrice && (
        <Tooltip content={`Zurücksetzen auf ${(variant._calculatedPrice ?? variant.variantPrice)?.toFixed(2) || 0}€`}>
          <Button
            icon={RefreshIcon}
            variant="plain"
            size="slim"
            onClick={() => handleResetPrice(variant.variantHandle)}
            accessibilityLabel="Preis zurücksetzen"
          />
        </Tooltip>
      )}
      <div style={{ width: "120px" }}>
        <TextField
          type="number"
          value={String(variant.variantPrice ?? "0.00")}
          onChange={(val) => handlePriceChange(variant.variantHandle, val)}
          onBlur={() => handlePriceChange(variant.variantHandle, formatPrice(variant.variantPrice))}
          suffix="€"
          autoComplete="off"
        />
      </div>
    </InlineStack>,
  ]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Variantenpreise
          </Text>
          {virtualVariants.length > 0 && (
            <Button
              icon={RefreshIcon}
              onClick={handleForceRegenerate}
              variant="plain"
              size="slim"
            >
              Alle neu berechnen
            </Button>
          )}
        </InlineStack>

        <Banner tone="info">
          <p>
            Die Preise werden automatisch aus dem Basispreis + Aufpreise der Optionen berechnet.
            Wenn du einen Preis manuell änderst, bleibt er auch bei automatischen Neu-Berechnungen erhalten.
          </p>
        </Banner>

        <InlineStack gap="300" blockAlign="end">
          <div style={{ width: "150px" }}>
            <TextField
              type="number"
              label="Basispreis (€)"
              value={String(basePrice ?? "0.00")}
              onChange={(val) => {
                onBasePriceChange(val);
              }}
              onBlur={() => onBasePriceChange(formatPrice(basePrice))}
              autoComplete="off"
            />
          </div>
          {virtualVariants.length === 0 && (
            <Button onClick={handleGenerate} variant="primary">
              Varianten generieren
            </Button>
          )}
        </InlineStack>

        {emptySwatchOptions.length > 0 && (
          <Banner tone="warning">
            <p>
              Folgende Auswahl-Optionen haben noch keine Werte:{" "}
              <strong>{emptySwatchOptions.map((o) => `„${o.name || "Unbenannt"}" (${OPTION_TYPE_LABELS[o.type] || o.type})`).join(", ")}</strong>.
              Varianten können erst generiert werden, wenn alle Auswahl-Optionen mindestens einen Wert haben.
            </p>
          </Banner>
        )}

        {virtualVariants.length === 0 && emptySwatchOptions.length === 0 ? (
          <Banner tone="info">
            <p>
              Noch keine Varianten. Klicke auf "Varianten generieren" oder speichere eine Auswahl-Option, um die Kombinationen automatisch zu erstellen.
            </p>
          </Banner>
        ) : (
          <>
            <InlineStack gap="200">
              <Text variant="bodySm" tone="subdued">
                {virtualVariants.length} Variante(n)
              </Text>
              {manualCount > 0 && (
                <Text variant="bodySm" tone="subdued">
                  · {manualCount} manuell angepasst
                </Text>
              )}
            </InlineStack>
            <DataTable
              columnContentTypes={["text", "numeric"]}
              headings={["Kombination", "Preis"]}
              rows={rows}
              sortable={[true, true]}
              defaultSortDirection="ascending"
              onSort={handleSort}
            />
          </>
        )}
      </BlockStack>
    </Card>
  );
}
