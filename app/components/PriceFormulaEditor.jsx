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
import { useTranslation } from "../utils/i18n";

const formatPrice = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
};

const cursorStyle = {
  display: "inline-block",
  width: "2px",
  height: "1.2em",
  backgroundColor: "var(--p-color-text)",
  verticalAlign: "text-bottom",
  animation: "vepo-blink 1s step-end infinite",
  marginInline: "1px",
};

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

const SWATCH_TYPES = ["variantswatch", "colorswatch", "imageswatch", "dropdown"];

export default function PriceFormulaEditor({
  formula,
  onChange,
  options,
  surchargesInFormula,
  minimumPrice,
  onMinimumPriceChange,
  roundingEnabled,
  onRoundingEnabledChange,
  roundingPrecision,
  onRoundingPrecisionChange,
}) {
  const { t } = useTranslation();
  const [previewResult, setPreviewResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragSourceIndex, setDragSourceIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [cursorPos, setCursorPos] = useState((formula || "").length);
  const [isFocused, setIsFocused] = useState(true);
  const editorRef = useRef(null);
  const containerRef = useRef(null);

  const ROUNDING_OPTIONS = useMemo(() => [
    { label: t("priceFormulaEditor.roundCent"), value: "0.01" },
    { label: "0.1", value: "0.1" },
    { label: t("priceFormulaEditor.roundEuro"), value: "1" },
    { label: "10", value: "10" },
    { label: "100", value: "100" },
    { label: "1000", value: "1000" },
  ], [t]);

  const variableNames = useMemo(() => 
    options
      .filter((o) =>
        o.type === "dimension" ||
        o.type === "dimensionselect" ||
        (surchargesInFormula && SWATCH_TYPES.includes(o.type))
      )
      .map((o) => o.name),
    [options, surchargesInFormula]
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

  const tokenBoundaries = useMemo(() => {
    const bounds = [];
    let offset = 0;
    for (const token of tokens) {
      bounds.push({ start: offset, end: offset + token.value.length, token });
      offset += token.value.length;
    }
    return bounds;
  }, [tokens]);

  const clampedCursor = Math.min(cursorPos, (formula || "").length);

  const insertAtCursor = useCallback((value) => {
    const f = formula || "";
    const pos = Math.min(cursorPos, f.length);
    onChange(f.slice(0, pos) + value + f.slice(pos));
    setCursorPos(pos + value.length);
  }, [formula, cursorPos, onChange]);

  const removeTokenAtIndex = useCallback((index) => {
    const newTokens = tokens.filter((_, i) => i !== index);
    const removedBound = tokenBoundaries[index];
    onChange(tokensToFormula(newTokens));
    if (removedBound && cursorPos > removedBound.start) {
      setCursorPos(Math.max(removedBound.start, cursorPos - removedBound.token.value.length));
    }
  }, [tokens, tokenBoundaries, cursorPos, onChange]);

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
        insertAtCursor(plainData);
      }
    }
    
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, [tokens, dropTargetIndex, onChange, insertAtCursor]);

  const handleEditorDragEnd = useCallback(() => {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleClear = () => {
    onChange("");
    setCursorPos(0);
  };

  const handleBackspace = () => {
    if (!formula || clampedCursor === 0) return;

    for (const bound of tokenBoundaries) {
      if (bound.end === clampedCursor && bound.token.type === "variable") {
        onChange(formula.slice(0, bound.start) + formula.slice(bound.end));
        setCursorPos(bound.start);
        return;
      }
    }

    const before = formula.slice(0, clampedCursor);
    if (before.endsWith("√(")) {
      onChange(before.slice(0, -2) + formula.slice(clampedCursor));
      setCursorPos(clampedCursor - 2);
      return;
    }

    onChange(formula.slice(0, clampedCursor - 1) + formula.slice(clampedCursor));
    setCursorPos(clampedCursor - 1);
  };

  const moveCursor = useCallback((direction) => {
    const f = formula || "";
    if (direction < 0 && clampedCursor === 0) return;
    if (direction > 0 && clampedCursor >= f.length) return;

    for (const bound of tokenBoundaries) {
      if (direction < 0 && bound.end === clampedCursor && bound.token.type === "variable") {
        setCursorPos(bound.start);
        return;
      }
      if (direction > 0 && bound.start === clampedCursor && bound.token.type === "variable") {
        setCursorPos(bound.end);
        return;
      }
    }

    setCursorPos(clampedCursor + direction);
  }, [formula, clampedCursor, tokenBoundaries]);

  const handleKeyDown = (e) => {
    const key = e.key;
    
    if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      insertAtCursor(key);
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
      insertAtCursor(keyMap[key]);
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

    if (key === "ArrowLeft") {
      e.preventDefault();
      moveCursor(-1);
      return;
    }

    if (key === "ArrowRight") {
      e.preventDefault();
      moveCursor(1);
      return;
    }

    if (key === "Home") {
      e.preventDefault();
      setCursorPos(0);
      return;
    }

    if (key === "End") {
      e.preventDefault();
      setCursorPos((formula || "").length);
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
      const re = new RegExp("\\[" + o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\]", "g");
      if (o.type === "dimension") {
        testFormula = testFormula.replace(re, "(" + String(o.default || 10) + ")");
      } else if (o.type === "dimensionselect") {
        let testValue = 10;
        try {
          const values = typeof o.values === "string" ? JSON.parse(o.values) : o.values || [];
          if (values.length > 0 && values[0].numericValue) {
            testValue = values[0].numericValue;
          }
        } catch (e) {}
        testFormula = testFormula.replace(re, "(" + String(testValue) + ")");
      } else if (surchargesInFormula && SWATCH_TYPES.includes(o.type)) {
        let testValue = 0;
        try {
          const values = typeof o.values === "string" ? JSON.parse(o.values) : o.values || [];
          if (values.length > 0 && values[0].surcharge) {
            testValue = parseFloat(values[0].surcharge) || 0;
          }
        } catch (e) {}
        testFormula = testFormula.replace(re, "(" + String(testValue) + ")");
      }
    });

    testFormula = testFormula.replace(/\)\(/g, ")*(");
    testFormula = testFormula.replace(/(\d)\(/g, "$1*(");
    testFormula = testFormula.replace(/\)(\d)/g, ")*$1");
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
  }, [formula, options, surchargesInFormula]);

  const handleEditorClick = useCallback((e) => {
    containerRef.current?.focus();
    setIsFocused(true);

    const charEl = e.target.closest("[data-char-offset]");
    if (charEl) {
      const offset = parseInt(charEl.dataset.charOffset, 10);
      const rect = charEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      setCursorPos(clickX > rect.width / 2 ? offset + 1 : offset);
      return;
    }

    const varEl = e.target.closest("[data-token-index]");
    if (varEl && varEl.dataset.tokenType === "variable") {
      const idx = parseInt(varEl.dataset.tokenIndex, 10);
      const bound = tokenBoundaries[idx];
      if (bound) {
        const rect = varEl.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        setCursorPos(clickX > rect.width / 2 ? bound.end : bound.start);
      }
      return;
    }

    setCursorPos((formula || "").length);
  }, [tokenBoundaries, formula]);

  const cursorElement = <span key="cursor" style={cursorStyle} />;

  const renderTokens = () => {
    if (tokens.length === 0) {
      return (
        <>
          {cursorElement}
          <span style={{ color: "#999", fontStyle: "italic" }}>
            {t("priceFormulaEditor.formulaPlaceholder")}
          </span>
        </>
      );
    }

    const elements = [];
    let charOffset = 0;

    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const isDropTarget = dropTargetIndex === index;
      const isDragging = dragSourceIndex === index;
      const tokenStart = charOffset;

      if (clampedCursor === tokenStart) {
        elements.push(cursorElement);
      }

      if (token.type === "variable") {
        elements.push(
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
        charOffset += token.value.length;
      } else {
        const chars = token.value.split("");
        const textParts = [];
        for (let ci = 0; ci < chars.length; ci++) {
          const absOffset = tokenStart + ci;
          if (ci > 0 && clampedCursor === absOffset) {
            elements.push(
              <span
                key={`text-${index}-pre-${ci}`}
                data-token-index={index}
                data-token-type="text"
                style={{ fontFamily: "monospace", position: "relative" }}
              >
                {isDropTarget && ci === 0 && (
                  <span style={{
                    position: "absolute", left: 0, top: 0, bottom: 0,
                    width: "3px", backgroundColor: "#008060", borderRadius: "2px",
                  }} />
                )}
                {textParts.map((tp, tpi) => (
                  <span key={tpi} data-char-offset={tp.offset}>{tp.char}</span>
                ))}
              </span>
            );
            textParts.length = 0;
            elements.push(cursorElement);
          }
          textParts.push({ char: chars[ci], offset: absOffset });
        }
        if (textParts.length > 0) {
          elements.push(
            <span
              key={`text-${index}-rest`}
              data-token-index={index}
              data-token-type="text"
              style={{ fontFamily: "monospace", position: "relative" }}
            >
              {isDropTarget && (
                <span style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: "3px", backgroundColor: "#008060", borderRadius: "2px",
                }} />
              )}
              {textParts.map((tp, tpi) => (
                <span key={tpi} data-char-offset={tp.offset}>{tp.char}</span>
              ))}
            </span>
          );
        }
        charOffset += token.value.length;
      }
    }

    if (clampedCursor >= charOffset) {
      elements.push(cursorElement);
    }

    return elements;
  };

  return (
    <Card>
      <style>{`@keyframes vepo-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } } .vepo-calc-grid .Polaris-Button { min-height: 44px; }`}</style>
      <div 
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{ outline: "none" }}
      >
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          {t("priceFormulaEditor.title")}
        </Text>
        <Text variant="bodySm" tone="subdued">
          {t("priceFormulaEditor.subtitle")}
        </Text>

        <BlockStack gap="100">
          <Text variant="bodySm" fontWeight="medium">{t("priceFormulaEditor.formula")}</Text>
          <InlineStack gap="200" align="center">
            <div 
              ref={editorRef}
              onDragOver={handleEditorDragOver}
              onDragLeave={handleEditorDragLeave}
              onDragStart={handleEditorDragStart}
              onDrop={handleEditorDrop}
              onDragEnd={handleEditorDragEnd}
              onClick={handleEditorClick}
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

        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            display: "flex",
            gap: "24px",
            justifyContent: "center",
            alignItems: "start",
            flexWrap: "wrap",
          }}
        >
          <div className="vepo-calc-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 64px)",
            gap: "6px",
          }}>
            <Button onClick={() => moveCursor(-1)} variant="secondary">◀</Button>
            <Button onClick={() => moveCursor(1)} variant="secondary">▶</Button>
            <Button onClick={handleClear} tone="critical">C</Button>
            <Button onClick={handleBackspace}>
              <span style={{ fontSize: "18px" }}>⌫</span>
            </Button>
            
            <Button onClick={() => insertAtCursor("(")} variant="secondary">(</Button>
            <Button onClick={() => insertAtCursor(")")} variant="secondary">)</Button>
            <Button onClick={() => insertAtCursor("√(")} variant="secondary">√</Button>
            <Button onClick={() => insertAtCursor("²")} variant="secondary">
              <span>x<sup>2</sup></span>
            </Button>
            
            <Button onClick={() => insertAtCursor("7")}>7</Button>
            <Button onClick={() => insertAtCursor("8")}>8</Button>
            <Button onClick={() => insertAtCursor("9")}>9</Button>
            <Button onClick={() => insertAtCursor(" / ")} variant="primary">/</Button>
            
            <Button onClick={() => insertAtCursor("4")}>4</Button>
            <Button onClick={() => insertAtCursor("5")}>5</Button>
            <Button onClick={() => insertAtCursor("6")}>6</Button>
            <Button onClick={() => insertAtCursor(" * ")} variant="primary">×</Button>
            
            <Button onClick={() => insertAtCursor("1")}>1</Button>
            <Button onClick={() => insertAtCursor("2")}>2</Button>
            <Button onClick={() => insertAtCursor("3")}>3</Button>
            <Button onClick={() => insertAtCursor(" - ")} variant="primary">−</Button>
            
            <Button onClick={() => insertAtCursor("0")}>0</Button>
            <Button onClick={() => insertAtCursor(".")}>.</Button>
            <Button onClick={() => insertAtCursor("-")} variant="secondary">(−)</Button>
            <Button onClick={() => insertAtCursor(" + ")} variant="primary">+</Button>
          </div>

          <div style={{ minWidth: "120px" }}>
            <BlockStack gap="200">
              <Text variant="bodySm" fontWeight="semibold">
                {t("priceFormulaEditor.variables")}
              </Text>
              {hasVariables ? (
                <>
                  {variableButtons.map((btn) => (
                    <div
                      key={btn.value}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", btn.value);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => insertAtCursor(btn.value)}
                      style={{
                        padding: "8px 14px",
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
                </>
              ) : (
                <Text variant="bodySm" tone="subdued">
                  {surchargesInFormula
                    ? t("priceFormulaEditor.noVariablesSurcharges")
                    : t("priceFormulaEditor.noVariables")}
                </Text>
              )}
            </BlockStack>
          </div>
        </div>

        <BlockStack gap="200">
          <Checkbox
            label={t("priceFormulaEditor.roundPrice")}
            checked={roundingEnabled}
            onChange={onRoundingEnabledChange}
          />
          {roundingEnabled && (
            <div style={{ maxWidth: "200px" }}>
              <Select
                label={t("priceFormulaEditor.roundTo")}
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
                  {t("priceFormulaEditor.validFormula", { value: previewResult.value.toFixed(2) })}
                </>
              )}
              {previewResult.status === "invalid" && t("priceFormulaEditor.invalidFormula")}
              {previewResult.status === "error" && t("priceFormulaEditor.syntaxError")}
            </Text>
          </Banner>
        )}

        <Divider />

        <TextField
          type="number"
          label={t("priceFormulaEditor.minimumPrice")}
          value={String(minimumPrice ?? "0.00")}
          onChange={onMinimumPriceChange}
          onBlur={() => onMinimumPriceChange(formatPrice(minimumPrice))}
          autoComplete="off"
          placeholder="0.00"
          helpText={t("priceFormulaEditor.minimumPriceHelp")}
        />
      </BlockStack>
      </div>
    </Card>
  );
}
