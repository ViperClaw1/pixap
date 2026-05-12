import { PhoneNumberUtil } from "google-libphonenumber";

export const phoneUtil = PhoneNumberUtil.getInstance();

export type CountryOption = {
  region: string;
  callingCode: string;
  flag: string;
};

export type PhoneValue = {
  /** ISO 3166-1 alpha-2 region code (e.g., "US"). */
  region: string;
  /** Numeric country calling code without "+" (e.g., "1"). */
  callingCode: string;
  /** Digits only, no formatting, no calling code. */
  nationalDigits: string;
};

export const DEFAULT_PHONE_VALUE: PhoneValue = {
  region: "US",
  callingCode: "1",
  nationalDigits: "",
};

export function regionToFlagEmoji(region: string): string {
  if (!region || region.length !== 2) return "🏳️";
  const codePoints = region
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function buildCountryOptions(): CountryOption[] {
  const options: CountryOption[] = [];
  for (const region of Array.from(phoneUtil.getSupportedRegions()).sort()) {
    try {
      const callingCode = phoneUtil.getCountryCodeForRegion(region).toString();
      if (!callingCode) continue;
      options.push({ region, callingCode, flag: regionToFlagEmoji(region) });
    } catch {
      // ignore unsupported regions
    }
  }
  return options;
}

/** Maximum national-significant digits allowed for a given region (E.164 caps total length at 15). */
export function getNationalMaxDigits(region: string, callingCode: string): number {
  try {
    const example = phoneUtil.getExampleNumber(region);
    if (example) {
      const nationalLength = example.getNationalNumberOrDefault().toString().length;
      if (nationalLength > 0) return nationalLength;
    }
  } catch {
    // fall through to ITU E.164 cap
  }
  return Math.max(1, 15 - callingCode.length);
}

/** Parse a stored E.164 (or digits-only) phone string into a structured value. */
export function parseStoredPhone(stored: string | null | undefined, fallback: PhoneValue = DEFAULT_PHONE_VALUE): PhoneValue {
  const raw = (stored ?? "").trim();
  if (!raw) return { ...fallback, nationalDigits: "" };
  if (raw.startsWith("+")) {
    try {
      const parsed = phoneUtil.parse(raw);
      const region = phoneUtil.getRegionCodeForNumber(parsed) ?? fallback.region;
      const callingCode = parsed.getCountryCodeOrDefault().toString() || fallback.callingCode;
      const nationalDigits = parsed.getNationalNumberOrDefault().toString();
      return { region, callingCode, nationalDigits };
    } catch {
      return { ...fallback, nationalDigits: raw.replace(/\D/g, "") };
    }
  }
  return { ...fallback, nationalDigits: raw.replace(/\D/g, "") };
}

/** Serialize structured value into E.164 ("+<calling><national>") or empty string if no digits. */
export function serializePhone(value: PhoneValue): string {
  const digits = value.nationalDigits.replace(/\D/g, "");
  if (!digits) return "";
  return `+${value.callingCode}${digits}`;
}

export type PhoneValidationError =
  | "required"
  | "invalid";

export function validatePhoneValue(value: PhoneValue, options: { required?: boolean } = {}): PhoneValidationError | null {
  const required = options.required ?? true;
  const digits = value.nationalDigits.replace(/\D/g, "");
  if (!digits) return required ? "required" : null;
  const full = `+${value.callingCode}${digits}`;
  try {
    const parsed = phoneUtil.parse(full, value.region);
    if (!phoneUtil.isValidNumber(parsed)) return "invalid";
  } catch {
    return "invalid";
  }
  return null;
}

const DEFAULT_VALIDATION_MESSAGES: Record<PhoneValidationError, string> = {
  required: "Phone is required.",
  invalid: "Please enter a valid phone number.",
};

/** Convenience: validate and return a human-readable English message (or null when valid). */
export function getPhoneValidationMessage(
  value: PhoneValue,
  options: { required?: boolean; messages?: Partial<Record<PhoneValidationError, string>> } = {},
): string | null {
  const error = validatePhoneValue(value, { required: options.required });
  if (!error) return null;
  return options.messages?.[error] ?? DEFAULT_VALIDATION_MESSAGES[error];
}
