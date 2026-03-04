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
import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

const ROUNDING_OPTIONS = [
  { label: "0.01 (Cent)", value: "0.01" },
  { label: "0.1", value: "0.1" },
  { label: "1 (Euro)", value: "1" },
  { label: "10", value: "10" },
  { label: "100", value: "100" },
  { label: "1000", value: "1000" },
];

const variableTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "2px 10px",
  margin: "0 3px",
  backgroundColor: "#f6f6f7",
  color: "#202223",
  border: "1px solid #8c9196",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: "500",
  cursor: "grab",
  userSelect: "none",
  verticalAlign: "middle",
  transition: "all 0.15s ease",
};

const parseFormulaToTokens = (formula, variableNames) => {
  if (!formula) return [];
  
  const tokens = [];
  let remaining = formula;
  
  while (remaining.length > 0) {
    let matched = false;
    
    for (const varName of variableNames) {
      const varPattern = `[${varName}]`;
      if (remaining.startsWith(varPattern)) {
        tokens.push({ type: "variable", value: varPattern, name: varName });
        remaining = remaining.slice(varPattern.length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      if (tokens.length > 0 && tokens[tokens.length - 1].type === "text") {
        tokens[tokens.length - 1].value += remaining[0];
      } else {
        tokens.push({ type: "text", value: remaining[0] });
      }
      remaining = remaining.slice(1);
    }
  }
  
  return tokens;
};

const tokensToFormula = (tokens) => {
  return tokens.map(t => t.value).join("");
};

const VariableTag = ({ name, value, index, onRemove, isDragging }) => {
  return (
    <span
      draggable
      data-token-index={index}
      data-token-type="variable"
      data-token-value={value}
      style={{
        ...variableTagStyle,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isDragging ? "#e4e5e7" : "#f6f6f7",
      }}
    >
      <span>{name}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          cursor: "pointer",
          marginLeft: "2px",
          color: "#6d7175",
          fontSize: "11px",
          fontWeight: "bold",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "#bf0711"}
        onMouseLeave={(e) => e.currentTarget.style.color = "#6d7175"}
      >
        ✕
      </span>
    </span>
  );
};

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
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragSourceIndex, setDragSourceIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  const variableNames = useMemo(() => 
    options
      .filter((o) => o.type === "dimension" || o.type === "dimensionselect")
      .map((o) => o.name),
    [options]
  );

  const variableButtons = variableNames.map((name) => ({
    label: `[${name}]`,
    value: `[${name}]`,
    name,
  }));

  const hasVariables = variableButtons.length > 0;

  const tokens = useMemo(() => 
    parseFormulaToTokens(formula, variableNames),
    [formula, variableNames]
  );

  const unclosedBrackets = useMemo(() => {
    if (!formula) return 0;
    let count = 0;
    for (const char of formula) {
      if (char === "(") count++;
      else if (char === ")") count--;
    }
    return Math.max(0, count);
  }, [formula]);

  const insertAtEnd = useCallback((value) => {
    onChange((formula || "") + value);
  }, [formula, onChange]);

  const removeTokenAtIndex = useCallback((index) => {
    const newTokens = tokens.filter((_, i) => i !== index);
    onChange(tokensToFormula(newTokens));
  }, [tokens, onChange]);

  const handleEditorDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
    
    const target = e.target.closest("[data-token-index]");
    if (target) {
      const idx = parseInt(target.dataset.tokenIndex, 10);
      setDropTargetIndex(idx);
    } else {
      setDropTargetIndex(null);
    }
  }, []);

  const handleEditorDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDropTargetIndex(null);
  }, []);

  const handleEditorDragStart = useCallback((e) => {
    const target = e.target.closest("[data-token-index]");
    if (target && target.dataset.tokenType === "variable") {
      const idx = parseInt(target.dataset.tokenIndex, 10);
      setDragSourceIndex(idx);
      e.dataTransfer.setData("text/plain", target.dataset.tokenValue);
      e.dataTransfer.setData("application/x-token-move", JSON.stringify({ index: idx }));
      e.dataTransfer.effectAllowed = "move";
    }
  }, []);

  const handleEditorDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const moveData = e.dataTransfer.getData("application/x-token-move");
    const plainData = e.dataTransfer.getData("text/plain");
    
    if (moveData) {
      try {
        const { index: sourceIndex } = JSON.parse(moveData);
        let targetIndex = dropTargetIndex;
        
        if (targetIndex === null) {
          targetIndex = tokens.length;
        }
        
        if (sourceIndex !== targetIndex && sourceIndex !== targetIndex - 1) {
          const newTokens = [...tokens];
          const [removed] = newTokens.splice(sourceIndex, 1);
          const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
          newTokens.splice(adjustedTarget, 0, removed);
          onChange(tokensToFormula(newTokens));
        }
      } catch {
        // Ignore parse errors
      }
    } else if (plainData && plainData.startsWith("[") && plainData.endsWith("]")) {
      if (dropTargetIndex !== null) {
        const newTokens = [...tokens];
        newTokens.splice(dropTargetIndex, 0, { 
          type: "variable", 
          value: plainData, 
          name: plainData.slice(1, -1) 
        });
        onChange(tokensToFormula(newTokens));
      } else {
        insertAtEnd(plainData);
      }
    }
    
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, [tokens, dropTargetIndex, onChange, insertAtEnd]);

  const handleEditorDragEnd = useCallback(() => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleClear = () => {
    onChange("");
  };

  const handleBackspace = () => {
    if (!formula) return;
    
    for (const varName of variableNames) {
      const varPattern = `[${varName}]`;
      if (formula.endsWith(varPattern)) {
        onChange(formula.slice(0, -varPattern.length));
        return;
      }
    }
    
    if (formula.endsWith("√(")) {
      onChange(formula.slice(0, -2));
      return;
    }
    
    onChange(formula.slice(0, -1));
  };

  const handleKeyDown = (e) => {
    const key = e.key;
    
    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      insertAtEnd(key);
      return;
    }
    
    const keyMap = {
      "+": " + ",
      "-": " - ",
      "*": " * ",
      "/": " / ",
      "x": " * ",
      "X": " * ",
      ".": ".",
      ",": ".",
      "(": "(",
      ")": ")",
      "^": "²",
    };
    
    if (keyMap[key]) {
      e.preventDefault();
      insertAtEnd(keyMap[key]);
      return;
    }
    
    if (key === "Backspace") {
      e.preventDefault();
      handleBackspace();
      return;
    }
    
    if (key === "Delete" || key === "Escape") {
      e.preventDefault();
      handleClear();
      return;
    }
  };

  useEffect(() => {
    if (!formula) {
      setPreviewResult(null);
      return;
    }

    let testFormula = formula;
    options.forEach((o) => {
      if (o.type === "dimension") {
        testFormula = testFormula.replace(
          new RegExp("\\[" + o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g"),
          String(o.default || 10)
        );
      } else if (o.type === "dimensionselect") {
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

    testFormula = testFormula.replace(/,/g, ".").replace(/x/gi, "*").replace(/÷/g, "/").replace(/%/g, "/100");
    testFormula = testFormula.replace(/√\(/g, "Math.sqrt(");
    testFormula = testFormula.replace(/²/g, "**2");
    testFormula = testFormula.replace(/[^\d+\-*/().Mathsqrt ]/g, "");

    try {
      const result = new Function(`"use strict"; return (${testFormula})`)();
      if (isNaN(result) || !isFinite(result)) {
        setPreviewResult({ status: "invalid", value: null });
      } else {
        setPreviewResult({ status: "valid", value: result });
      }
    } catch {
      setPreviewResult({ status: "error", value: null });
    }
  }, [formula, options]);

  const renderTokens = () => {
    if (tokens.length === 0) {
      return (
        <span style={{ color: "#999", fontStyle: "italic" }}>
          Formel hier eingeben...
        </span>
      );
    }

    return tokens.map((token, index) => {
      const isDropTarget = dropTargetIndex === index;
      const isDragging = dragSourceIndex === index;
      
      if (token.type === "variable") {
        return (
          <span key={`${token.value}-${index}`} style={{ position: "relative" }}>
            {isDropTarget && (
              <span style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "3px",
                backgroundColor: "#008060",
                borderRadius: "2px",
              }} />
            )}
            <VariableTag
              name={token.name}
              value={token.value}
              index={index}
              onRemove={() => removeTokenAtIndex(index)}
              isDragging={isDragging}
            />
          </span>
        );
      }
      return (
        <span 
          key={`text-${index}`}
          data-token-index={index}
          data-token-type="text"
          style={{ 
            fontFamily: "monospace",
            position: "relative",
          }}
        >
          {isDropTarget && (
            <span style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "3px",
              backgroundColor: "#008060",
              borderRadius: "2px",
            }} />
          )}
          {token.value}
        </span>
      );
    });
  };

  return (
    <Card>
      <div 
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ outline: "none" }}
      >
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Preisformel-Rechner
        </Text>
        <Text variant="bodySm" tone="subdued">
          Tippe mit der Tastatur oder klicke die Buttons. Variablen können hineingezogen und verschoben werden.
        </Text>

        <BlockStack gap="100">
          <Text variant="bodySm" fontWeight="medium">Formel</Text>
          <InlineStack gap="200" align="center">
            <div 
              ref={editorRef}
              onDragOver={handleEditorDragOver}
              onDragLeave={handleEditorDragLeave}
              onDragStart={handleEditorDragStart}
              onDrop={handleEditorDrop}
              onDragEnd={handleEditorDragEnd}
              onClick={() => containerRef.current?.focus()}
              style={{
                flex: 1,
                minHeight: "44px",
                padding: "10px 12px",
                fontSize: "16px",
                fontFamily: "monospace",
                border: isDragOver 
                  ? "2px dashed #008060" 
                  : "1px solid var(--p-color-border)",
                borderRadius: "8px",
                backgroundColor: isDragOver 
                  ? "#f1f8f5" 
                  : "var(--p-color-bg-surface)",
                color: "var(--p-color-text)",
                cursor: "text",
                lineHeight: "1.8",
                transition: "all 0.15s ease",
              }}
            >
              {renderTokens()}
            </div>
            {unclosedBrackets > 0 && (
              <Text tone="subdued">
                <span style={{ fontFamily: "monospace" }}>
                  {")".repeat(unclosedBrackets)}
                </span>
              </Text>
            )}
          </InlineStack>
        </BlockStack>

        <InlineStack gap="400" align="start" wrap={false}>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(4, 50px)", 
            gap: "8px"
          }}>
            <div style={{ gridColumn: "span 2" }}>
              <Button onClick={handleClear} tone="critical" fullWidth>C</Button>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <Button onClick={handleBackspace} fullWidth>
                <span style={{ fontSize: "18px" }}>⌫</span>
              </Button>
            </div>
            
            <Button onClick={() => insertAtEnd("(")} variant="secondary">(</Button>
            <Button onClick={() => insertAtEnd(")")} variant="secondary">)</Button>
            <Button onClick={() => insertAtEnd("√(")} variant="secondary">√</Button>
            <Button onClick={() => insertAtEnd("²")} variant="secondary">
              <span>x<sup>2</sup></span>
            </Button>
            
            <Button onClick={() => insertAtEnd("7")}>7</Button>
            <Button onClick={() => insertAtEnd("8")}>8</Button>
            <Button onClick={() => insertAtEnd("9")}>9</Button>
            <Button onClick={() => insertAtEnd(" / ")} variant="primary">/</Button>
            
            <Button onClick={() => insertAtEnd("4")}>4</Button>
            <Button onClick={() => insertAtEnd("5")}>5</Button>
            <Button onClick={() => insertAtEnd("6")}>6</Button>
            <Button onClick={() => insertAtEnd(" * ")} variant="primary">×</Button>
            
            <Button onClick={() => insertAtEnd("1")}>1</Button>
            <Button onClick={() => insertAtEnd("2")}>2</Button>
            <Button onClick={() => insertAtEnd("3")}>3</Button>
            <Button onClick={() => insertAtEnd(" - ")} variant="primary">−</Button>
            
            <Button onClick={() => insertAtEnd("0")}>0</Button>
            <Button onClick={() => insertAtEnd(".")}>.</Button>
            <Button onClick={() => insertAtEnd("-")} variant="secondary">(−)</Button>
            <Button onClick={() => insertAtEnd(" + ")} variant="primary">+</Button>
          </div>

          <BlockStack gap="200">
            <Text variant="bodySm" fontWeight="semibold">
              Variablen (ziehen oder klicken)
            </Text>
            {hasVariables ? (
              <BlockStack gap="200">
                {variableButtons.map((btn) => (
                  <div
                    key={btn.value}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", btn.value);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => insertAtEnd(btn.value)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#f6f6f7",
                      color: "#202223",
                      border: "1px solid #8c9196",
                      borderRadius: "6px",
                      cursor: "grab",
                      fontSize: "13px",
                      fontWeight: "500",
                      textAlign: "center",
                      userSelect: "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#e4e5e7";
                      e.currentTarget.style.borderColor = "#6d7175";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f6f6f7";
                      e.currentTarget.style.borderColor = "#8c9196";
                    }}
                  >
                    {btn.name}
                  </div>
                ))}
              </BlockStack>
            ) : (
              <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                <Text variant="bodySm" tone="subdued">
                  Erstelle eine „Maßeingabe" oder „Maß-Auswahl" Option, um Variablen hier zu sehen.
                </Text>
              </Box>
            )}
          </BlockStack>
        </InlineStack>

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

        {previewResult && (
          <Banner tone={previewResult.status === "valid" ? "success" : "warning"}>
            <Text as="span">
              {previewResult.status === "valid" && (
                <>
                  Korrekte Formel — Beispielergebnis: <strong>{previewResult.value.toFixed(2)} €</strong>
                </>
              )}
              {previewResult.status === "invalid" && "Formel ergibt keinen gültigen Wert"}
              {previewResult.status === "error" && "Syntaxfehler in der Formel"}
            </Text>
          </Banner>
        )}

        <Divider />

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
      </div>
    </Card>
  );
}
