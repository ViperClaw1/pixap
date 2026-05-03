import Constants from "expo-constants";
import * as Linking from "expo-linking";

type Extra = { oauthMobileRedirectUri?: string };

function getOptionalOverride(): string | undefined {
  const extra =
    (Constants.expoConfig?.extra as Extra | undefined) ??
    ((Constants.manifest2 as { extra?: Extra } | null | undefined)?.extra ?? undefined) ??
    ((Constants.manifest as { extra?: Extra } | null | undefined)?.extra ?? undefined);
  const fromExtra = extra?.oauthMobileRedirectUri?.trim();
  if (fromExtra) return fromExtra;
  const fromEnv = process.env.EXPO_PUBLIC_OAUTH_MOBILE_REDIRECT_URI?.trim();
  return fromEnv || undefined;
}

/**
 * OAuth `redirectTo` for native. Must match **exactly** one entry in Supabase
 * Dashboard → Authentication → URL Configuration → Redirect URLs.
 *
 * Default: app scheme from `app.config.ts` (`scheme`), e.g. `pixap://~oauth/callback`.
 */
export function getOAuthRedirectUri(): string {
  const override = getOptionalOverride();
  // Explicitly ignore Expo Go callbacks to keep OAuth native-only.
  if (override && !override.startsWith("exp://")) return override;
  return Linking.createURL("~oauth/callback");
}
