/**
 * WhatsApp template suffix (`_ru` / `_en`) from venue `business_cards.contact_whatsapp`,
 * not from the app UI language.
 */

/** @returns {"ru"|"en"} */
function waTemplateLocaleFromOwnerPhone(phone) {
  const trimmed = String(phone || "").trim();
  if (!trimmed) return "en";

  const compact = trimmed.replace(/[\s()-]/g, "");

  if (compact.startsWith("+7") || compact.startsWith("+37") || compact.startsWith("+995") || compact.startsWith("+996"))  {
    return "ru";
  }

  const digits = compact.replace(/\D/g, "");
  if (digits.startsWith("7")) {
    return "ru";
  }

  return "en";
}

module.exports = {
  waTemplateLocaleFromOwnerPhone,
};
