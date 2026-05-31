import { env } from "@/shared/lib/env";

type GoogleSigninStatic = typeof import("@react-native-google-signin/google-signin").GoogleSignin;

let configured = false;

export function configureGoogleSignIn(GoogleSignin: GoogleSigninStatic): void {
  if (configured) return;

  const webClientId = env.googleWebClientId;
  if (!webClientId) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID");
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: env.googleIosClientId,
    offlineAccess: false,
  });

  configured = true;
}
