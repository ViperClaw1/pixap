import { APP_LANGUAGES, type AppLanguage } from "@/shared/lib/i18n/init";
import { normalizeBusinessCardImages } from "@/shared/lib/business-card/businessCardImages";

const NON_EN_LOCALES = ["ru", "es", "pt", "fr", "de"] as const;
type NonEnLocale = (typeof NON_EN_LOCALES)[number];

/** Raw `business_cards` row fields used to resolve UI locale. */
export type BusinessCardI18nRow = {
  name: string;
  description?: string | null;
  tags?: string[] | null;
  name_ru?: string | null;
  name_es?: string | null;
  name_pt?: string | null;
  name_fr?: string | null;
  name_de?: string | null;
  description_ru?: string | null;
  description_es?: string | null;
  description_pt?: string | null;
  description_fr?: string | null;
  description_de?: string | null;
  tags_ru?: string[] | null;
  tags_es?: string[] | null;
  tags_pt?: string[] | null;
  tags_fr?: string[] | null;
  tags_de?: string[] | null;
  images?: unknown;
  /** Legacy single-image column; merged into `images` when the array is empty. */
  image?: string | null;
};

export const BUSINESS_CARD_I18N_COLUMN_LIST =
  "name, name_ru, name_es, name_pt, name_fr, name_de, description, description_ru, description_es, description_pt, description_fr, description_de, tags, tags_ru, tags_es, tags_pt, tags_fr, tags_de";

/** List/home query — static string for PostgREST + Supabase type inference. */
export const BUSINESS_CARD_LIST_SELECT = [
  "id",
  BUSINESS_CARD_I18N_COLUMN_LIST,
  "images",
  "image",
  "category_id",
  "city",
  "address",
  "rating",
  "booking_price",
  "phone",
  "contact_whatsapp",
  "type",
  "created_at",
  "latitude",
  "longitude",
  "blurhashes",
  "category:categories(id, name)",
].join(", ");

const embed = (extra: string) =>
  `business_card:business_cards(id, ${BUSINESS_CARD_I18N_COLUMN_LIST}, ${extra})`;

export const FAVORITES_SELECT = `*, ${embed("images, address, rating, booking_price, type")}`;
export const CART_ITEMS_SELECT = `*, ${embed("images, address, category_id, contact_whatsapp")}`;
export const BOOKINGS_SELECT = `*, ${embed("images, address, category_id")}`;
export const SHOPPING_CART_SELECT = `*, shopping_item:shopping_items(*), ${embed("images, contact_whatsapp")}`;
export const PIXAI_BUSINESS_CARD_SELECT = `id, ${BUSINESS_CARD_I18N_COLUMN_LIST}, address, city, rating, booking_price, images`;

function resolveAppLanguage(language: string): AppLanguage {
  const base = language.split("-")[0]?.toLowerCase() ?? "en";
  return APP_LANGUAGES.includes(base as AppLanguage) ? (base as AppLanguage) : "en";
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nonEmptyTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return tags.length > 0 ? tags : null;
}

/** Ensures list/detail queries always expose `images[0]` for thumbnails. */
export function normalizeBusinessCardRowImages(row: {
  images?: unknown;
  image?: string | null;
}): string[] {
  const fromArray = normalizeBusinessCardImages(row.images);
  if (fromArray.length > 0) return fromArray;
  const legacy = normalizeBusinessCardImages(row.image);
  return legacy;
}

export function localizeBusinessCardFields(
  row: BusinessCardI18nRow,
  language: string,
): { name: string; description: string; tags: string[] } {
  const lang = resolveAppLanguage(language);
  if (lang === "en") {
    return {
      name: nonEmptyString(row.name) ?? "",
      description: nonEmptyString(row.description) ?? "",
      tags: nonEmptyTags(row.tags) ?? [],
    };
  }

  const locale = lang as NonEnLocale;
  return {
    name: nonEmptyString(row[`name_${locale}`]) ?? nonEmptyString(row.name) ?? "",
    description:
      nonEmptyString(row[`description_${locale}`]) ?? nonEmptyString(row.description) ?? "",
    tags: nonEmptyTags(row[`tags_${locale}`]) ?? nonEmptyTags(row.tags) ?? [],
  };
}

export function localizeBusinessCard<T extends BusinessCardI18nRow>(row: T, language: string): T {
  return {
    ...row,
    ...localizeBusinessCardFields(row, language),
    images: normalizeBusinessCardRowImages(row),
  };
}
