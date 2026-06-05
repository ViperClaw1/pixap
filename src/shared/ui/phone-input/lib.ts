import { PhoneNumberUtil, PhoneNumberType } from "google-libphonenumber";

export const phoneUtil = PhoneNumberUtil.getInstance();

export type CountryOption = {
  region: string;
  callingCode: string;
  flag: string;
  name: string;
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

export function getCountryDisplayName(region: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? region;
  } catch {
    return region;
  }
}

const countryOptionsCache = new Map<string, CountryOption[]>();

export function buildCountryOptions(locale = "en"): CountryOption[] {
  const cached = countryOptionsCache.get(locale);
  if (cached) return cached;

  const options: CountryOption[] = [];
  for (const region of phoneUtil.getSupportedRegions()) {
    try {
      const callingCode = phoneUtil.getCountryCodeForRegion(region).toString();
      if (!callingCode) continue;
      options.push({
        region,
        callingCode,
        flag: regionToFlagEmoji(region),
        name: getCountryDisplayName(region, locale),
      });
    } catch {
      // ignore unsupported regions
    }
  }
  const sorted = options.sort((a, b) => a.name.localeCompare(b.name, locale));
  countryOptionsCache.set(locale, sorted);
  return sorted;
}

/** Pre-build country list so Edit Profile / phone fields open without a long JS stall. */
export function warmPhoneInputCache(locale = "en"): void {
  buildCountryOptions(locale);
}

export function filterCountryOptions(options: CountryOption[], query: string): CountryOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return options;
  const digits = trimmed.replace(/\D/g, "");
  return options.filter((option) => {
    if (option.name.toLowerCase().includes(trimmed)) return true;
    if (option.region.toLowerCase().includes(trimmed)) return true;
    if (digits && option.callingCode.includes(digits)) return true;
    if (trimmed.startsWith("+") && `+${option.callingCode}`.startsWith(trimmed)) return true;
    return false;
  });
}

const PHONE_NUMBER_TYPES_TO_CHECK = [
  PhoneNumberType.MOBILE,
  PhoneNumberType.FIXED_LINE,
  PhoneNumberType.FIXED_LINE_OR_MOBILE,
  PhoneNumberType.TOLL_FREE,
  PhoneNumberType.PREMIUM_RATE,
  PhoneNumberType.SHARED_COST,
  PhoneNumberType.VOIP,
  PhoneNumberType.PERSONAL_NUMBER,
  PhoneNumberType.PAGER,
  PhoneNumberType.UAN,
] as const;

/** Maximum national-significant digits allowed for a given region (E.164 caps total length at 15). */
export function getNationalMaxDigits(region: string, callingCode: string): number {
  try {
    let maxLen = 0;
    for (const type of PHONE_NUMBER_TYPES_TO_CHECK) {
      try {
        const example = phoneUtil.getExampleNumberForType(region, type);
        if (example) {
          const len = example.getNationalNumberOrDefault().toString().length;
          if (len > maxLen) maxLen = len;
        }
      } catch {
        // this type not available for region — skip
      }
    }
    if (maxLen > 0) return maxLen;
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
