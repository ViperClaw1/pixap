const WHATSAPP_BUSINESS_PREFIXES = require("./whatsappFriendlyPrefixes.json");

// Sorted longest-first once at module load to avoid re-sorting per call.
const SORTED_PREFIXES = [...WHATSAPP_BUSINESS_PREFIXES].sort((a, b) => b.length - a.length);

function normalizedPhone(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * Returns "whatsapp" for regions where WhatsApp is an established business channel,
 * "voice" everywhere else (US, CA, UK, AU, JP, KR, CN, TW, FR …).
 *
 * Longest-prefix-match is critical: Caribbean NANP codes like +1809 must be
 * evaluated before the generic +1 (US/Canada) entry.
 *
 * @param {string} ownerPhone
 * @returns {"whatsapp"|"voice"}
 */
function bookingChannelFromOwnerPhone(ownerPhone) {
  const normalized = normalizedPhone(ownerPhone);
  const isWhatsappRegion = SORTED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  return isWhatsappRegion ? "whatsapp" : "voice";
}

module.exports = { bookingChannelFromOwnerPhone, WHATSAPP_BUSINESS_PREFIXES };
