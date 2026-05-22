import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { localizeBusinessCard, type BusinessCardI18nRow } from "./localizeBusinessCard";

/** Resolves `name`, `description`, `tags` for the active UI language (fallback: English). */
export function useLocalizedBusinessCard<T extends BusinessCardI18nRow | null | undefined>(
  card: T,
): T {
  const { i18n } = useTranslation();
  return useMemo(() => {
    if (card == null) return card;
    return localizeBusinessCard(card, i18n.language);
  }, [card, i18n.language]);
}
