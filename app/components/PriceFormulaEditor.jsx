import {
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Text,
  Banner,
  Box,
  Divider,
  Checkbox,
  Select,
} from "@shopify/polaris";
import { useState, useEffect, useMemo } from "react";

// Format price: remove leading zeros, ensure 2 decimal places
const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

// Rounding options
const ROUNDING_OPTIONS = [
  { label: "0.01 (Cent)", value: "0.01" },
  { label: "0.1", value: "0.1" },
  { label: "1 (Euro)", value: "1" },
  { label: "10", value: "10" },
  { label: "100", value: "100" },
  { label: "1000", value: "1000" },
];

export default function PriceFormulaEditor({
  formula,
  onChange,
  options,
  minimumPrice,
  onMinimumPriceChange,
  roundingEnabled,
  onRoundingEnabledChange,
  roundingPrecision,
  onRoundingPrecisionChange,
}) {
  const [previewResult, setPreviewResult] = useState(null);

  // Build variable buttons from options - only dimensions and dimensionselect make sense for calculations
  const variableButtons = options
    .filter((o) => o.type === "dimension" || o.type === "dimensionselect")
    .map((o) => ({
      label: `[${o.name}]`,
      value: `[${o.name}]`,
    }));

  const hasVariables = variableButtons.length > 0;

  // Count unclosed brackets to show grayed out closing brackets
  const unclosedBrackets = useMemo(() => {
    if (!formula) return 0;
    let count = 0;
    for (const char of formula) {
      if (char === "(") count++;
      else if (char === ")") count--;
    }
    return Math.max(0, count);
  }, [formula]);

  // Append value to formula
  const appendToFormula = (value) => {
    onChange(formula + value);
  };

  // Add square (wrap last element in parentheses with ²)
  const handleSquare = () => {
    if (!formula) return;
    
    // Check if last element is a variable
    const variableMatch = formula.match(/\[[^\]]+\]$/);
    if (variableMatch) {
      const before = formula.slice(0, -variableMatch[0].length);
      onChange(before + "(" + variableMatch[0] + ")²");
      return;
    }
    
    // Check if last element is a closing bracket - just add ²
    if (formula.endsWith(")")) {
      onChange(formula + "²");
      return;
    }
    
    // Check if last element is a number
    const numberMatch = formula.match(/(\d+\.?\d*)$/);
    if (numberMatch) {
      const before = formula.slice(0, -numberMatch[0].length);
      onChange(before + "(" + numberMatch[0] + ")²");
      return;
    }
    
    // Fallback: just add ²
    onChange(formula + "²");
  };

  // Delete last character, variable, or function
  const handleBackspace = () => {
    if (!formula) return;
    
    // Check if formula ends with a variable like [variablename]
    const variableMatch = formula.match(/\[[^\]]+\]$/);
    if (variableMatch) {
      onChange(formula.slice(0, -variableMatch[0].length));
      return;
    }
    
    // Check if formula ends with )² (squared)
    if (formula.endsWith(")²")) {
      onChange(formula.slice(0, -1)); // Just remove the ²
      return;
    }
    
    // Check if formula ends with √(
    if (formula.endsWith("√(")) {
      onChange(formula.slice(0, -2));
      return;
    }
    
    // Remove last character (including space if part of operator)
    const trimmed = formula.trimEnd();
    if (trimmed !== formula) {
      // There was trailing space, remove operator with spaces
      const operatorMatch = trimmed.match(/\s*[+\-*/]\s*$/);
      if (operatorMatch) {
        onChange(trimmed.slice(0, -operatorMatch[0].length));
      } else {
        onChange(formula.slice(0, -1));
      }
    } else {
      onChange(formula.slice(0, -1));
    }
  };

  // Clear entire formula
  const handleClear = () => {
    onChange("");
  };

  // Calculate preview
  useEffect(() => {
    if (!formula) {
      setPreviewResult(null);
      return;
    }

    let testFormula = formula;
    // Replace variables with test values - only dimensions and dimensionselect are valid for formulas
    options.forEach((o) => {
      if (o.type === "dimension") {
        testFormula = testFormula.replace(
          new RegExp("\\[" + o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g"),
          String(o.default || 10)
        );
      } else if (o.type === "dimensionselect") {
        // Use first value's numericValue as test value
        let testValue = 10;
        try {
          const values = typeof o.values === "string" ? JSON.parse(o.values) : o.values || [];
          if (values.length > 0 && values[0].numericValue) {
            testValue = values[0].numericValue;
          }
        } catch (e) {}
        testFormula = testFormula.replace(
          new RegExp("\\[" + o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g"),
          String(testValue)
        );
      }
    });

    // Clean and evaluate - translate custom functions to JavaScript
    testFormula = testFormula.replace(/,/g, ".").replace(/x/gi, "*").replace(/÷/g, "/").replace(/%/g, "/100");
    // Translate: √(...) → Math.sqrt(...), ² → **2
    testFormula = testFormula.replace(/√\(/g, "Math.sqrt(");
    testFormula = testFormula.replace(/²/g, "**2");
    // Remove any remaining invalid characters
    testFormula = testFormula.replace(/[^\d+\-*/().Mathsqrt ]/g, "");

    try {
      const result = new Function(`"use strict"; return (${testFormula})`)();
      if (isNaN(result) || !isFinite(result)) {
        setPreviewResult("invalid");
      } else {
        setPreviewResult("valid");
      }
    } catch {
      setPreviewResult("error");
    }
  }, [formula, options]);

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Preisformel-Rechner
        </Text>

        {/* Formula Display - Read Only */}
        <Box
          background="bg-surface-secondary"
          padding="400"
          borderRadius="200"
          borderColor="border"
          borderWidth="025"
        >
          <BlockStack gap="100">
            <Text variant="bodySm" tone="subdued">Formel</Text>
            <div style={{ 
              minHeight: "40px", 
              fontFamily: "monospace", 
              fontSize: "16px",
              wordBreak: "break-all",
              padding: "8px 0"
            }}>
              {formula ? (
                <>
                  {formula}
                  {unclosedBrackets > 0 && (
                    <span style={{ color: "var(--p-color-text-disabled)" }}>
                      {")".repeat(unclosedBrackets)}
                    </span>
                  )}
                </>
              ) : (
                <Text tone="subdued">Erstelle deine Formel mit den Buttons unten...</Text>
              )}
            </div>
          </BlockStack>
        </Box>

        {/* Calculator and Variables Side by Side */}
        <InlineStack gap="400" align="start" wrap={false}>
          {/* Calculator Grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 50px)", 
            gap: "8px"
          }}>
            {/* Row 1: C C ⌫ ⌫ */}
            <div style={{ gridColumn: "span 2" }}>
              <Button onClick={handleClear} tone="critical" fullWidth>C</Button>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <Button onClick={handleBackspace} fullWidth>
                <span style={{ fontSize: "18px" }}>⌫</span>
              </Button>
            </div>
            
            {/* Row 2: ( ) √ x² */}
            <Button onClick={() => appendToFormula("(")} variant="secondary">(</Button>
            <Button onClick={() => appendToFormula(")")} variant="secondary">)</Button>
            <Button onClick={() => appendToFormula("√(")} variant="secondary">√</Button>
            <Button onClick={handleSquare} variant="secondary">
              <span>x<sup>2</sup></span>
            </Button>
            
            {/* Row 3: 7 8 9 / */}
            <Button onClick={() => appendToFormula("7")}>7</Button>
            <Button onClick={() => appendToFormula("8")}>8</Button>
            <Button onClick={() => appendToFormula("9")}>9</Button>
            <Button onClick={() => appendToFormula(" / ")} variant="primary">/</Button>
            
            {/* Row 4: 4 5 6 * */}
            <Button onClick={() => appendToFormula("4")}>4</Button>
            <Button onClick={() => appendToFormula("5")}>5</Button>
            <Button onClick={() => appendToFormula("6")}>6</Button>
            <Button onClick={() => appendToFormula(" * ")} variant="primary">×</Button>
            
            {/* Row 5: 1 2 3 - */}
            <Button onClick={() => appendToFormula("1")}>1</Button>
            <Button onClick={() => appendToFormula("2")}>2</Button>
            <Button onClick={() => appendToFormula("3")}>3</Button>
            <Button onClick={() => appendToFormula(" - ")} variant="primary">−</Button>
            
            {/* Row 6: 0 , (-) + */}
            <Button onClick={() => appendToFormula("0")}>0</Button>
            <Button onClick={() => appendToFormula(".")}>.</Button>
            <Button onClick={() => appendToFormula("-")} variant="secondary">(−)</Button>
            <Button onClick={() => appendToFormula(" + ")} variant="primary">+</Button>
          </div>

          {/* Variables Section - Right Side */}
          <BlockStack gap="200">
            <Text variant="bodySm" fontWeight="semibold">
              Variablen
            </Text>
            {hasVariables ? (
              <BlockStack gap="200">
                {variableButtons.map((btn) => (
                  <Button
                    key={btn.value}
                    onClick={() => appendToFormula(btn.value)}
                    tone="success"
                    fullWidth
                  >
                    {btn.label}
                  </Button>
                ))}
              </BlockStack>
            ) : (
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" tone="subdued">
                  Keine Maß-Optionen vorhanden. Füge eine Maßeingabe oder Maß-Auswahl hinzu.
                </Text>
              </Box>
            )}
          </BlockStack>
        </InlineStack>

        {/* Rounding Option */}
        <BlockStack gap="200">
          <Checkbox
            label="Endpreis runden"
            checked={roundingEnabled}
            onChange={onRoundingEnabledChange}
          />
          {roundingEnabled && (
            <div style={{ maxWidth: "200px" }}>
              <Select
                label="Runden auf"
                labelHidden
                options={ROUNDING_OPTIONS}
                value={String(roundingPrecision || "1")}
                onChange={onRoundingPrecisionChange}
              />
            </div>
          )}
        </BlockStack>

        {/* Formula Validation */}
        {previewResult && (
          <Banner tone={previewResult === "valid" ? "success" : "warning"}>
            <Text as="span">
              {previewResult === "valid" && "Korrekte Formel — Keine Syntaxfehler gefunden"}
              {previewResult === "invalid" && "Formel ergibt keinen gültigen Wert"}
              {previewResult === "error" && "Syntaxfehler in der Formel"}
            </Text>
          </Banner>
        )}

        <Divider />

        {/* Minimum Price */}
        <TextField
          type="number"
          label="Mindestpreis (€)"
          value={String(minimumPrice ?? "0.00")}
          onChange={onMinimumPriceChange}
          onBlur={() => onMinimumPriceChange(formatPrice(minimumPrice))}
          autoComplete="off"
          placeholder="0.00"
          helpText="Der berechnete Preis wird mindestens diesen Wert haben"
        />
      </BlockStack>
    </Card>
  );
}
