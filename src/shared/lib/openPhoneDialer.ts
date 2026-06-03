import { Linking } from "react-native";

const PLACEHOLDER_PHONE = /^[—\-–.\s]+$/;

/** Builds a `tel:` URI from free-text venue phone (Google Places, admin input, etc.). */
export function buildTelUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || PLACEHOLDER_PHONE.test(trimmed)) return null;

  const withoutExt = trimmed.replace(/\s*(?:ext|x|#)\s*\.?\s*\d+\s*$/i, "");
  const compact = withoutExt.replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 3) return null;

  const dial = compact.startsWith("+") || trimmed.startsWith("+") ? `+${digits}` : digits;
  return `tel:${dial}`;
}

export type OpenPhoneDialerResult = "ok" | "invalid" | "unavailable";

/**
 * Opens the system phone dialer.
 * `openURL` throws when the scheme is unavailable, so a separate `canOpenURL('tel:...')`
 * pre-check only adds bridge latency and can require platform-specific query config.
 */
export async function openPhoneDialer(raw: string): Promise<OpenPhoneDialerResult> {
  const url = buildTelUrl(raw);
  if (!url) return "invalid";

  try {
    await Linking.openURL(url);
    return "ok";
  } catch {
    return "unavailable";
  }
}
