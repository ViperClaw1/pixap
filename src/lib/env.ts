import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  oauthRedirectBase?: string;
  stripeReturnScheme?: string;
  /** Reverse-proxy API (e.g. https://api.pixapp.kz). If unset, payment calls use Supabase /functions/v1 directly. */
  pixappApiUrl?: string;
  /** Optional fully-qualified endpoint override for PayPal create-order. */
  paypalCreateOrderUrl?: string;
  /** Optional fully-qualified endpoint override for PayPal capture-order. */
  paypalCaptureOrderUrl?: string;
  /** Maps SDK + Directions/Geocoding REST (same key if APIs enabled in Google Cloud) */
  googleMapsApiKey?: string;
  /** Optional dedicated key for Google Geocoding/Directions web-service requests. */
  googleMapsWebApiKey?: string;
  /** Digits-only E.164 for PixAI WhatsApp fallback (availability messages). */
  pixaiWhatsAppE164?: string;
  /** Store product id for PixAI monthly subscription. */
  pixAiMonthlySubscriptionSku?: string;
};

function getExtra(): Extra {
  const extra =
    (Constants.expoConfig?.extra as Extra | undefined) ??
    ((Constants.manifest2 as { extra?: Extra } | null | undefined)?.extra ?? undefined) ??
    ((Constants.manifest as { extra?: Extra } | null | undefined)?.extra ?? undefined);
  return extra ?? {};
}

export const env = {
  get supabaseUrl(): string {
    const v = getExtra().supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!v) throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL / extra.supabaseUrl");
    return v;
  },
  get supabaseAnonKey(): string {
    const v = getExtra().supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!v) throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY / extra.supabaseAnonKey");
    return v;
  },
  /**
   * HTTPS origin for email confirmation / password reset links (not mobile OAuth callback).
   * Allowlist in Supabase Auth redirect URLs if you use hosted pages.
   */
  get oauthRedirectBase(): string {
    return (
      getExtra().oauthRedirectBase ??
      process.env.EXPO_PUBLIC_OAUTH_REDIRECT_BASE ??
      "https://pixapp.kz"
    );
  },
  /** Deep link scheme for Stripe/PayPal return (e.g. pixap) — success/cancel paths appended */
  get stripeReturnScheme(): string {
    return (getExtra().stripeReturnScheme ?? process.env.EXPO_PUBLIC_STRIPE_RETURN_SCHEME ?? "pixap").toLowerCase();
  },
  /** Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — enable Maps SDK, Directions API, Geocoding API. */
  get googleMapsApiKey(): string | undefined {
    const v = getExtra().googleMapsApiKey ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return v && v.length > 0 ? v : undefined;
  },
  /**
   * Optional `EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY` for REST calls (Directions/Geocoding).
   * Falls back to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` when unset.
   */
  get googleMapsWebApiKey(): string | undefined {
    const v =
      getExtra().googleMapsWebApiKey ??
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ??
      getExtra().googleMapsApiKey ??
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return v && v.length > 0 ? v : undefined;
  },
  /** Default +971525235996 when unset; store digits only for wa.me. */
  get pixaiWhatsAppDigits(): string {
    const raw = getExtra().pixaiWhatsAppE164 ?? process.env.EXPO_PUBLIC_PIXAI_WHATSAPP_E164 ?? "971525235996";
    const digits = raw.replace(/\D/g, "");
    return digits.length >= 8 ? digits : "971525235996";
  },
  get pixAiMonthlySubscriptionSku(): string {
    return (
      getExtra().pixAiMonthlySubscriptionSku ??
      process.env.EXPO_PUBLIC_PIXAI_MONTHLY_SUBSCRIPTION_SKU ??
      "pixai_premium_monthly"
    ).trim();
  },
  /**
   * Optional `EXPO_PUBLIC_PIXAPP_API_URL` = `https://api.pixapp.kz` (reverse proxy to Edge Functions).
   * If omitted, PayPal order creation uses `{supabaseUrl}/functions/v1/paypal-create-order`.
   */
  get paypalCreateOrderUrl(): string {
    const direct =
      getExtra().paypalCreateOrderUrl ??
      process.env.EXPO_PUBLIC_PAYPAL_CREATE_ORDER_URL;
    if (direct?.trim()) return direct.trim();

    const pixapp =
      getExtra().pixappApiUrl ??
      process.env.EXPO_PUBLIC_PIXAPP_API_URL ??
      process.env.EXPO_PUBLIC_PAYMENT_API_BASE_URL;
    if (pixapp?.trim()) {
      return `${pixapp.replace(/\/$/, "")}/v1/paypal/create-order`;
    }
    return `${this.supabaseUrl.replace(/\/$/, "")}/functions/v1/paypal-create-order`;
  },
  /**
   * Optional `EXPO_PUBLIC_PIXAPP_API_URL` = `https://api.pixapp.kz` (reverse proxy to Edge Functions).
   * If omitted, PayPal capture uses `{supabaseUrl}/functions/v1/paypal-capture-order`.
   */
  get paypalCaptureOrderUrl(): string {
    const direct =
      getExtra().paypalCaptureOrderUrl ??
      process.env.EXPO_PUBLIC_PAYPAL_CAPTURE_ORDER_URL;
    if (direct?.trim()) return direct.trim();

    const pixapp =
      getExtra().pixappApiUrl ??
      process.env.EXPO_PUBLIC_PIXAPP_API_URL ??
      process.env.EXPO_PUBLIC_PAYMENT_API_BASE_URL;
    if (pixapp?.trim()) {
      return `${pixapp.replace(/\/$/, "")}/v1/paypal/capture-order`;
    }
    return `${this.supabaseUrl.replace(/\/$/, "")}/functions/v1/paypal-capture-order`;
  },
};
