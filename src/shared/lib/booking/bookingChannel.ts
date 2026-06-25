// Mirrors backend/wa-booking-service/services/bookingChannelRegion.js
// Longest-first so Caribbean NANP codes (+1809 etc.) match before generic +1.
const SORTED_WA_PREFIXES = [
  "+1809", "+1829", "+1849", "+1876", "+1868", "+1242", "+1246",
  "+374", "+375", "+380", "+372", "+371", "+370", "+373", "+351",
  "+506", "+507", "+502", "+504", "+503", "+505",
  "+591", "+593", "+595", "+598",
  "+880", "+960", "+961", "+962", "+964", "+965", "+966", "+968",
  "+971", "+972", "+973", "+974", "+977",
  "+992", "+993", "+994", "+995", "+996", "+998",
  "+212", "+213", "+216", "+221", "+225", "+233", "+234", "+237",
  "+243", "+251", "+254", "+255", "+256", "+263",
  "+20", "+27",
  "+31", "+32", "+34", "+39", "+41", "+43", "+48", "+49",
  "+51", "+52", "+54", "+55", "+56", "+57", "+58",
  "+60", "+62", "+63", "+65", "+66",
  "+84", "+90", "+91", "+92", "+94",
  "+7",
].sort((a, b) => b.length - a.length);

export type BookingChannel = "whatsapp" | "voice" | "email" | "unknown";

export function bookingChannelFromPhone(phone: string | null | undefined): BookingChannel {
  const raw = (phone ?? "").replace(/\s/g, "");
  if (!raw) return "unknown";
  const normalized = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  return SORTED_WA_PREFIXES.some((p) => normalized.startsWith(p)) ? "whatsapp" : "voice";
}
