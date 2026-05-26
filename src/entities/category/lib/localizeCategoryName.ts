import type { TFunction } from "i18next";
import { i18n } from "@/shared/lib/i18n";

const CATEGORY_I18N_KEYS = new Set([
  "restaurants",
  "bars",
  "beauty",
  "clubs",
  "entertainment",
  "fitness",
  "hotels",
  "events",
  "tourism",
]);

function categoryNameToKey(name: string): string | null {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_I18N_KEYS.has(normalized) ? normalized : null;
}

/** Display label for `public.categories.name` (English in DB). */
export function localizeCategoryName(name: string, t?: TFunction): string {
  const trimmed = name.trim();
  if (!trimmed) return name;
  const key = categoryNameToKey(trimmed);
  if (!key) return trimmed;
  const translate = t ?? ((k, opts) => i18n.t(k, opts));
  return translate(key, { keyPrefix: "bookingCategories", defaultValue: trimmed });
}
