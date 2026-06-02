import { Linking, Platform } from "react-native";

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
 * On Android 11+, `Linking.canOpenURL('tel:…')` is often false without manifest queries;
 * `openURL` still works, so Android skips the pre-check (iOS keeps `canOpenURL`).
 */
export async function openPhoneDialer(raw: string): Promise<OpenPhoneDialerResult> {
  const url = buildTelUrl(raw);
  if (!url) return "invalid";

  try {
    if (Platform.OS === "ios") {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return "unavailable";
    }
    await Linking.openURL(url);
    return "ok";
  } catch {
    return "unavailable";
  }
}
