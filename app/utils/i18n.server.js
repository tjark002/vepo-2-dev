import de from "../locales/de.json";
import en from "../locales/en.json";

const locales = { de, en };

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

export function serverT(key, vars, locale = "de") {
  const translations = locales[locale] || locales.de;
  let val = getNestedValue(translations, key);
  if (val === undefined) {
    val = getNestedValue(locales.de, key);
  }
  if (val === undefined) return key;
  if (vars) {
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`
    );
  }
  return val;
}
