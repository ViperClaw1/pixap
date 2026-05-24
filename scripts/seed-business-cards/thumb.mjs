/**
 * @deprecated Prefer `./pregen.mjs`. Kept for existing imports.
 */
export {
  BUSINESS_CARD_PREGEN_VARIANTS,
  businessCardPregenStoragePath,
  pregenObjectPathFromPublicUrl,
  pregenPublicUrlFromOriginalPublicUrl,
  uploadBusinessCardAllPregens,
  uploadBusinessCardPregen,
} from "./pregen.mjs";

import { uploadBusinessCardPregen, pregenPublicUrlFromOriginalPublicUrl, businessCardPregenStoragePath } from "./pregen.mjs";

export const BUSINESS_CARD_THUMB_SUFFIX = "_thumb";
export const BUSINESS_CARD_THUMB_FILE = "_thumb.webp";
export const BUSINESS_CARD_THUMB_LONG_EDGE = 256;

export const businessCardThumbStoragePath = (objectPath) => businessCardPregenStoragePath(objectPath, "thumb");
export const thumbObjectPathFromPublicUrl = (publicUrl) =>
  publicUrl?.includes("/object/public/business-cards/")
    ? businessCardPregenStoragePath(
        publicUrl.split("/object/public/business-cards/")[1]?.split("?")[0]?.split("#")[0] ?? "",
        "thumb",
      )
    : null;
export const thumbPublicUrlFromOriginalPublicUrl = (publicUrl) =>
  pregenPublicUrlFromOriginalPublicUrl(publicUrl, "thumb");
export const uploadBusinessCardThumb = (supabase, originalObjectPath, sourceBytes) =>
  uploadBusinessCardPregen(supabase, originalObjectPath, sourceBytes, "thumb");
