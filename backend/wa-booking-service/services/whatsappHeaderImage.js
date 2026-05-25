/**
 * WhatsApp template header images (dynamic IMAGE header in Meta).
 * All templates in the booking flow use the same logo unless overridden per template.
 */

/** Full Meta template names used in the booking conversation flow. */
const FLOW_TEMPLATE_IDS = new Set([
  "check_availability_eng",
  "check_availability_rus",
  "check_price_eng",
  "check_price_rus",
  "confirm_eng",
  "confirm_rus",
  // legacy aliases (header env / migration)
  "check_is_available_en",
  "check_is_available_ru",
  "chech_free_or_set_price_en",
  "chech_free_or_set_price_ru",
  "got_it_en",
  "got_it_ru",
]);

function flowTemplatesUseStaticHeaderInMeta() {
  return (
    process.env.WHATSAPP_FLOW_TEMPLATES_STATIC_HEADER === "1" ||
    process.env.WHATSAPP_FLOW_TEMPLATES_STATIC_HEADER === "true"
  );
}

function templateUsesDynamicImageHeader(templateId) {
  const id = String(templateId);
  if (flowTemplatesUseStaticHeaderInMeta()) {
    return Boolean(resolveTemplateHeaderImageUrl(id));
  }
  if (FLOW_TEMPLATE_IDS.has(id)) return true;
  const explicitList = String(process.env.WHATSAPP_IMAGE_HEADER_REQUIRED_TEMPLATES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return explicitList.includes(id);
}

/**
 * Supabase Storage private object URLs return JSON 400 to Meta and to HEAD probes.
 * Rewrite `/storage/v1/object/{bucket}/...` → `/storage/v1/object/public/{bucket}/...`
 * when the bucket is public (required for WhatsApp media fetch).
 */
function normalizeMediaUrlForWhatsApp(raw) {
  const url = String(raw || "").trim();
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("supabase.co")) return url;

    const path = parsed.pathname;
    if (path.includes("/storage/v1/object/public/")) return url;
    if (path.includes("/storage/v1/object/sign/") || path.includes("/storage/v1/object/authenticated/")) {
      return url;
    }

    const objectMatch = path.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (objectMatch) {
      const [, bucket, rest] = objectMatch;
      if (bucket !== "public" && bucket !== "sign" && bucket !== "authenticated") {
        parsed.pathname = `/storage/v1/object/public/${bucket}/${rest}`;
        return parsed.toString();
      }
    }

    return url;
  } catch {
    return url;
  }
}

function readEnv(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : undefined;
}

/** Shared logo for every flow template (recommended single Railway variable). */
function sharedHeaderLogoUrl() {
  return (
    readEnv("WHATSAPP_HEADER_LOGO_URL") ||
    readEnv("WHATSAPP_TEMPLATE_HEADER_LOGO_URL") ||
    readEnv("WHATSAPP_TEMPLATE_HEADER_IMAGE_URL")
  );
}

/**
 * Resolve HTTPS image URL for a template header.
 * Order: per-template env → legacy aliases → shared logo (flow templates only).
 */
function resolveTemplateHeaderImageUrl(templateId) {
  const templateName = String(templateId);

  const generic = readEnv(`WHATSAPP_TEMPLATE_${templateName.toUpperCase()}_HEADER_IMAGE_URL`);
  if (generic) return normalizeMediaUrlForWhatsApp(generic);

  const legacyByName = {
    check_availability: readEnv("WHATSAPP_CHECK_AVAILABILITY_HEADER_IMAGE_URL"),
    check_availability_eng: readEnv("WHATSAPP_CHECK_AVAILABILITY_ENG_HEADER_IMAGE_URL"),
    check_availability_rus: readEnv("WHATSAPP_CHECK_AVAILABILITY_RUS_HEADER_IMAGE_URL"),
    check_price_eng: readEnv("WHATSAPP_CHECK_PRICE_ENG_HEADER_IMAGE_URL"),
    check_price_rus: readEnv("WHATSAPP_CHECK_PRICE_RUS_HEADER_IMAGE_URL"),
    confirm_eng: readEnv("WHATSAPP_CONFIRM_ENG_HEADER_IMAGE_URL"),
    confirm_rus: readEnv("WHATSAPP_CONFIRM_RUS_HEADER_IMAGE_URL"),
    check_is_available_en: readEnv("WHATSAPP_CHECK_IS_AVAILABLE_EN_HEADER_IMAGE_URL"),
    check_is_available_ru: readEnv("WHATSAPP_CHECK_IS_AVAILABLE_RU_HEADER_IMAGE_URL"),
    chech_free_or_set_price_en:
      readEnv("WHATSAPP_CHECH_FREE_OR_SET_PRICE_EN_HEADER_IMAGE_URL") ||
      readEnv("WHATSAPP_CHECK_FREE_OR_SET_PRICE_EN_HEADER_IMAGE_URL"),
    chech_free_or_set_price_ru:
      readEnv("WHATSAPP_CHECH_FREE_OR_SET_PRICE_RU_HEADER_IMAGE_URL") ||
      readEnv("WHATSAPP_CHECK_FREE_OR_SET_PRICE_RU_HEADER_IMAGE_URL"),
    got_it_en: readEnv("WHATSAPP_GOT_IT_EN_HEADER_IMAGE_URL"),
    got_it_ru: readEnv("WHATSAPP_GOT_IT_RU_HEADER_IMAGE_URL"),
    check_is_free: readEnv("WHATSAPP_CHECK_IS_FREE_HEADER_IMAGE_URL"),
    get_payment_link: readEnv("WHATSAPP_GET_PAYMENT_LINK_HEADER_IMAGE_URL"),
  };
  const legacy = legacyByName[templateName];
  if (legacy) return normalizeMediaUrlForWhatsApp(legacy);

  const availabilityLegacy = readEnv("WHATSAPP_CHECK_AVAILABILITY_HEADER_IMAGE_URL");
  if (
    availabilityLegacy &&
    (templateName.startsWith("check_availability_") || templateName.startsWith("check_is_available_"))
  ) {
    return normalizeMediaUrlForWhatsApp(availabilityLegacy);
  }

  if (FLOW_TEMPLATE_IDS.has(templateName)) {
    const shared = sharedHeaderLogoUrl();
    if (shared) return normalizeMediaUrlForWhatsApp(shared);
  }

  return undefined;
}

function missingHeaderEnvHint(templateId) {
  return (
    `Template "${templateId}" requires a header image URL for Meta (dynamic IMAGE header). ` +
    `Set WHATSAPP_HEADER_LOGO_URL to one public HTTPS JPG/PNG (same logo for all flow templates), ` +
    `or WHATSAPP_TEMPLATE_${String(templateId).toUpperCase()}_HEADER_IMAGE_URL. ` +
    `For Supabase Storage use .../storage/v1/object/public/<bucket>/<path> (public bucket).`
  );
}

module.exports = {
  FLOW_TEMPLATE_IDS,
  flowTemplatesUseStaticHeaderInMeta,
  templateUsesDynamicImageHeader,
  normalizeMediaUrlForWhatsApp,
  resolveTemplateHeaderImageUrl,
  sharedHeaderLogoUrl,
  missingHeaderEnvHint,
};
