import type { AppLanguage } from "@/shared/lib/i18n/init";

const SPEECH_LOCALES: Record<AppLanguage, string> = {
  en: "en-US",
  ru: "ru-RU",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
};

export function mapSpeechLocale(languageTag: string): string {
  const base = languageTag.split("-")[0]?.toLowerCase() ?? "en";
  if (base in SPEECH_LOCALES) {
    return SPEECH_LOCALES[base as AppLanguage];
  }
  return "en-US";
}
