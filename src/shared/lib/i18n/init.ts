import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const APP_LANGUAGE_STORAGE_KEY = "@pixap_app_language";

export const APP_LANGUAGES = ["en", "ru", "es", "pt", "fr", "de"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

function loadLocale(lng: AppLanguage): Record<string, unknown> {
  switch (lng) {
    case "ru": return require("./locales/ru.json");
    case "es": return require("./locales/es.json");
    case "fr": return require("./locales/fr.json");
    case "pt": return require("./locales/pt.json");
    case "de": return require("./locales/de.json");
    default:   return require("./locales/en.json");
  }
}

function normalizeLanguage(tag: string | null | undefined): AppLanguage {
  if (!tag) return "en";
  const base = tag.split("-")[0]?.toLowerCase() ?? "en";
  return APP_LANGUAGES.includes(base as AppLanguage) ? (base as AppLanguage) : "en";
}

function deviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode;
  return normalizeLanguage(code ?? undefined);
}

let bootstrapPromise: Promise<void> | null = null;
let languageListenerAttached = false;

/**
 * Fast i18n bootstrap: device locale only, no AsyncStorage — unblocks first paint.
 */
export function bootstrapI18n(): Promise<void> {
  if (i18n.isInitialized) {
    return Promise.resolve();
  }
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const lng = deviceLanguage();

    await i18n.use(initReactI18next).init({
      resources: { [lng]: { translation: loadLocale(lng) } },
      lng,
      fallbackLng: "en",
      supportedLngs: [...APP_LANGUAGES],
      compatibilityJSON: "v4",
      ignoreJSONStructure: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

    if (!languageListenerAttached) {
      languageListenerAttached = true;
      i18n.on("languageChanged", (next) => {
        void AsyncStorage.setItem(APP_LANGUAGE_STORAGE_KEY, next).catch(() => undefined);
      });
    }
  })();

  return bootstrapPromise;
}

/**
 * Apply saved language after first interactions (AsyncStorage).
 */
export async function hydrateI18nFromStorage(): Promise<void> {
  if (!i18n.isInitialized) return;
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(APP_LANGUAGE_STORAGE_KEY);
  } catch {
    return;
  }
  if (stored != null && APP_LANGUAGES.includes(stored as AppLanguage) && stored !== i18n.language) {
    const lang = stored as AppLanguage;
    if (!i18n.hasResourceBundle(lang, "translation")) {
      i18n.addResourceBundle(lang, "translation", loadLocale(lang));
    }
    await i18n.changeLanguage(lang);
  }
}

export async function switchLanguage(lang: AppLanguage): Promise<void> {
  if (!i18n.hasResourceBundle(lang, "translation")) {
    i18n.addResourceBundle(lang, "translation", loadLocale(lang));
  }
  await i18n.changeLanguage(lang);
}

/** Full init (bootstrap + storage) — for tests or callers that need storage before UI. */
export async function initI18n(): Promise<void> {
  await bootstrapI18n();
  await hydrateI18nFromStorage();
}

export { i18n };
