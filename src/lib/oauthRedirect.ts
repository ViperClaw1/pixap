import Constants from "expo-constants";
import * as Linking from "expo-linking";

type Extra = { oauthMobileRedirectUri?: string };

function getOptionalOverride(): string | undefined {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const fromExtra = extra?.oauthMobileRedirectUri?.trim();
  if (fromExtra) return fromExtra;
  const fromEnv = process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI?.trim();
  return fromEnv || undefined;
}

/**
 * OAuth `redirectTo` for native. Must match **exactly** one entry in Supabase
 * Dashboard → Authentication → URL Configuration → Redirect URLs.
 *
 * Default: app scheme from `app.config.ts` (`scheme`), e.g. `pixapp://~oauth/callback`.
 * In Expo Go dev, this is often an `exp://…` URL — add that exact string to Supabase while testing.
 */
export function getOAuthRedirectUri(): string {
  const override = getOptionalOverride();
  const appOwnership = Constants.appOwnership;
  // Expo Go can require `exp://...` callback URLs.
  if (override && (appOwnership === "expo" || !override.startsWith("exp://"))) {
    return override;
  }
  // Dev Client / standalone should prefer scheme callbacks like `pixapp://...`.
  return Linking.createURL("~oauth/callback");
}
