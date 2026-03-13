import { createContext, useContext, useCallback } from "react";
import de from "../locales/de.json";
import en from "../locales/en.json";

const locales = { de, en };

const I18nContext = createContext("de");

export function I18nProvider({ locale = "de", children }) {
  return (
    <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>
  );
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

export function useTranslation() {
  const locale = useContext(I18nContext);
  const translations = locales[locale] || locales.de;

  const t = useCallback(
    (key, vars) => {
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
    },
    [translations],
  );

  return { t, locale };
}
