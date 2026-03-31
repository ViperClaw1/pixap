import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  oauthRedirectBase?: string;
  stripeReturnScheme?: string;
  /** Maps SDK + Directions/Geocoding REST (same key if APIs enabled in Google Cloud) */
  googleMapsApiKey?: string;
};

function getExtra(): Extra {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
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
  /** Deep link scheme for Stripe return (e.g. pixapp) — success/cancel paths appended */
  get stripeReturnScheme(): string {
    return getExtra().stripeReturnScheme ?? process.env.EXPO_PUBLIC_STRIPE_RETURN_SCHEME ?? "pixapp";
  },
  /** Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — enable Maps SDK, Directions API, Geocoding API. */
  get googleMapsApiKey(): string | undefined {
    const v = getExtra().googleMapsApiKey ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    return v && v.length > 0 ? v : undefined;
  },
};
