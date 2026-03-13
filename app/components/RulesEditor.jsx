import {
  Card,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Select,
  TextField,
  Banner,
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, ChevronUpIcon, ChevronDownIcon } from "@shopify/polaris-icons";
import { useCallback, useMemo } from "react";
import { useTranslation } from "../utils/i18n";

const SWATCH_TYPES = ["variantswatch", "colorswatch", "imageswatch", "dropdown", "dimensionselect"];

function getOptionValues(option) {
  if (!option || !option.values) return [];
  try {
    const values = typeof option.values === "string" ? JSON.parse(option.values) : option.values;
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

export default function RulesEditor({ rules, onChange, options }) {
  const { t } = useTranslation();

  const operators = useMemo(() => [
    { label: t("rulesEditor.equals"), value: "equals" },
    { label: t("rulesEditor.notEquals"), value: "not-equals" },
    { label: t("rulesEditor.greaterThan"), value: "greater-than" },
    { label: t("rulesEditor.lessThan"), value: "less-than" },
    { label: t("rulesEditor.contains"), value: "contains" },
  ], [t]);

  const optionChoices = options.map((o) => ({
    label: o.name || t("common.unnamedOption"),
    value: String(o.id || o.tempId),
  }));

  const optionsById = useMemo(() => {
    const map = {};
    for (const opt of options) {
      map[opt.id || opt.tempId] = opt;
    }
    return map;
  }, [options]);

  const addRule = useCallback(() => {
    const newPriority = rules.length;
    const firstOpt = options[0];
    const firstOptId = firstOpt?.id || firstOpt?.tempId || "";
    let initialValue = "";
    if (firstOpt && SWATCH_TYPES.includes(firstOpt.type)) {
      const vals = getOptionValues(firstOpt);
      if (vals[0]) {
        initialValue = vals[0].name || vals[0].numericValue || String(0);
      }
    }
    onChange([
      ...rules,
      {
        tempId: "rule_" + Date.now(),
        show: true,
        targetOptionId: firstOptId,
        targetValueId: null,
        priority: newPriority,
        conditions: [
          {
            tempId: "cond_" + Date.now(),
            optionId: firstOptId,
            operator: "equals",
            value: initialValue,
          },
        ],
      },
    ]);
  }, [rules, onChange, options]);

  const removeRule = useCallback(
    (ruleIndex) => {
      const updated = rules.filter((_, i) => i !== ruleIndex);
      const reindexed = updated.map((r, i) => ({ ...r, priority: i }));
      onChange(reindexed);
    },
    [rules, onChange]
  );

  const moveRule = useCallback(
    (fromIndex, direction) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= rules.length) return;

      const updated = [...rules];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reindexed = updated.map((r, i) => ({ ...r, priority: i }));
      onChange(reindexed);
    },
    [rules, onChange]
  );

  const updateRule = useCallback(
    (ruleIndex, field, value) => {
      const updated = [...rules];
      updated[ruleIndex] = { ...updated[ruleIndex], [field]: value };
      if (field === "targetOptionId") {
        updated[ruleIndex].targetValueId = null;
      }
      onChange(updated);
    },
    [rules, onChange]
  );

  const addCondition = useCallback(
    (ruleIndex) => {
      const firstOpt = options[0];
      const firstOptId = firstOpt?.id || firstOpt?.tempId || "";
      let initialValue = "";
      if (firstOpt && SWATCH_TYPES.includes(firstOpt.type)) {
        const vals = getOptionValues(firstOpt);
        if (vals[0]) {
          initialValue = vals[0].name || vals[0].numericValue || String(0);
        }
      }
      const updated = [...rules];
      updated[ruleIndex] = {
        ...updated[ruleIndex],
        conditions: [
          ...updated[ruleIndex].conditions,
          {
            tempId: "cond_" + Date.now(),
            optionId: firstOptId,
            operator: "equals",
            value: initialValue,
          },
        ],
      };
      onChange(updated);
    },
    [rules, onChange, options]
  );

  const removeCondition = useCallback(
    (ruleIndex, condIndex) => {
      const updated = [...rules];
      updated[ruleIndex] = {
        ...updated[ruleIndex],
        conditions: updated[ruleIndex].conditions.filter((_, i) => i !== condIndex),
      };
      onChange(updated);
    },
    [rules, onChange]
  );

  const updateCondition = useCallback(
    (ruleIndex, condIndex, field, value) => {
      const updated = [...rules];
      const conditions = [...updated[ruleIndex].conditions];
      conditions[condIndex] = { ...conditions[condIndex], [field]: value };
      if (field === "optionId") {
        const opt = optionsById[value];
        if (opt && SWATCH_TYPES.includes(opt.type)) {
          const vals = getOptionValues(opt);
          const firstVal = vals[0];
          conditions[condIndex].value = firstVal
            ? (firstVal.name || firstVal.numericValue || String(0))
            : "";
        } else {
          conditions[condIndex].value = "";
        }
      }
      updated[ruleIndex] = { ...updated[ruleIndex], conditions };
      onChange(updated);
    },
    [rules, onChange, optionsById]
  );

  const getValueChoicesForOption = useCallback((optionId) => {
    const option = optionsById[optionId];
    if (!option) return null;
    if (!SWATCH_TYPES.includes(option.type)) return null;
    
    const values = getOptionValues(option);
    if (values.length === 0) return null;
    
    return values.map((v, idx) => ({
      label: v.name || v.numericValue || t("rulesEditor.valueN", { index: idx + 1 }),
      value: v.name || v.numericValue || String(idx),
    }));
  }, [optionsById, t]);

  const getTargetValueChoices = useCallback((optionId) => {
    const option = optionsById[optionId];
    if (!option) return null;
    if (!SWATCH_TYPES.includes(option.type)) return null;
    
    const values = getOptionValues(option);
    if (values.length === 0) return null;
    
    return [
      { label: t("rulesEditor.allValues"), value: "" },
      ...values.map((v, idx) => ({
        label: v.name || v.numericValue || t("rulesEditor.valueN", { index: idx + 1 }),
        value: v.id || v.name || String(idx),
      })),
    ];
  }, [optionsById, t]);

  if (options.length < 2) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text variant="headingMd" as="h3">
            {t("rulesEditor.title")}
          </Text>
          <Banner tone="info">
            <p>{t("rulesEditor.needTwoOptions")}</p>
          </Banner>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h3">
            {t("rulesEditor.title")}
          </Text>
          <Button onClick={addRule} icon={PlusIcon}>
            {t("rulesEditor.addRule")}
          </Button>
        </InlineStack>

        <Text variant="bodySm" tone="subdued">
          {t("rulesEditor.description")}
        </Text>

        {rules.length === 0 ? (
          <Banner tone="info">
            <p>{t("rulesEditor.noRules")}</p>
          </Banner>
        ) : (
          <BlockStack gap="400">
            {rules.map((rule, ruleIndex) => {
              const targetValueChoices = getTargetValueChoices(rule.targetOptionId);
              
              return (
                <Card key={rule.id || rule.tempId}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <InlineStack gap="100">
                          <Button
                            icon={ChevronUpIcon}
                            variant="plain"
                            size="slim"
                            disabled={ruleIndex === 0}
                            onClick={() => moveRule(ruleIndex, -1)}
                            accessibilityLabel={t("common.moveUp")}
                          />
                          <Button
                            icon={ChevronDownIcon}
                            variant="plain"
                            size="slim"
                            disabled={ruleIndex === rules.length - 1}
                            onClick={() => moveRule(ruleIndex, 1)}
                            accessibilityLabel={t("common.moveDown")}
                          />
                        </InlineStack>
                        <Text variant="bodyMd" fontWeight="semibold">
                          {t("rulesEditor.rule", { index: ruleIndex + 1 })}
                        </Text>
                      </InlineStack>
                      <Button
                        icon={DeleteIcon}
                        variant="plain"
                        tone="critical"
                        onClick={() => removeRule(ruleIndex)}
                      />
                    </InlineStack>

                    <InlineStack gap="300" blockAlign="end" wrap>
                      <Select
                        label={t("rulesEditor.action")}
                        options={[
                          { label: t("rulesEditor.show"), value: "true" },
                          { label: t("rulesEditor.hide"), value: "false" },
                        ]}
                        value={String(rule.show)}
                        onChange={(val) => updateRule(ruleIndex, "show", val === "true")}
                      />
                      <Select
                        label={t("rulesEditor.targetOption")}
                        options={optionChoices}
                        value={String(rule.targetOptionId)}
                        onChange={(val) =>
                          updateRule(ruleIndex, "targetOptionId", parseInt(val) || val)
                        }
                      />
                      {targetValueChoices && (
                        <Select
                          label={t("rulesEditor.targetValue")}
                          options={targetValueChoices}
                          value={rule.targetValueId || ""}
                          onChange={(val) =>
                            updateRule(ruleIndex, "targetValueId", val || null)
                          }
                        />
                      )}
                    </InlineStack>

                    <Text variant="bodySm" fontWeight="semibold">
                      {t("rulesEditor.whenConditionsMet")}
                    </Text>

                    {rule.conditions.map((condition, condIndex) => {
                      const valueChoices = getValueChoicesForOption(condition.optionId);
                      
                      return (
                        <InlineStack
                          key={condition.id || condition.tempId}
                          gap="200"
                          blockAlign="end"
                          wrap
                        >
                          <Select
                            label={condIndex === 0 ? t("rulesEditor.option") : ""}
                            options={optionChoices}
                            value={String(condition.optionId)}
                            onChange={(val) =>
                              updateCondition(ruleIndex, condIndex, "optionId", parseInt(val) || val)
                            }
                          />
                          <Select
                            label={condIndex === 0 ? t("rulesEditor.operator") : ""}
                            options={operators}
                            value={condition.operator}
                            onChange={(val) =>
                              updateCondition(ruleIndex, condIndex, "operator", val)
                            }
                          />
                          {valueChoices ? (
                            <Select
                              label={condIndex === 0 ? t("common.value") : ""}
                              options={valueChoices}
                              value={condition.value}
                              onChange={(val) =>
                                updateCondition(ruleIndex, condIndex, "value", val)
                              }
                            />
                          ) : (
                            <TextField
                              label={condIndex === 0 ? t("common.value") : ""}
                              value={condition.value}
                              onChange={(val) =>
                                updateCondition(ruleIndex, condIndex, "value", val)
                              }
                              autoComplete="off"
                            />
                          )}
                          <Button
                            icon={DeleteIcon}
                            variant="plain"
                            tone="critical"
                            onClick={() => removeCondition(ruleIndex, condIndex)}
                          />
                        </InlineStack>
                      );
                    })}

                    <Button
                      size="slim"
                      onClick={() => addCondition(ruleIndex)}
                    >
                      {t("rulesEditor.addCondition")}
                    </Button>
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
