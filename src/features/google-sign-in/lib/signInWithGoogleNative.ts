import { Platform } from "react-native";
import { supabase } from "@/shared/api/supabase/client";
import { devError, devInfo } from "@/shared/lib/devLog";
import type { GoogleNativeSignInResult } from "../types";
import { configureGoogleSignIn } from "./configureGoogleSignIn";

type GoogleSignInModule = typeof import("@react-native-google-signin/google-signin");

export async function signInWithGoogleNative(): Promise<GoogleNativeSignInResult> {
  let googleSignIn: GoogleSignInModule | null = null;

  try {
    googleSignIn = await import("@react-native-google-signin/google-signin");
    const { GoogleSignin, isCancelledResponse, isSuccessResponse } = googleSignIn;

    configureGoogleSignIn(GoogleSignin);

    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    try {
      await GoogleSignin.signOut();
    } catch {
      /* no cached session — account picker still opens on signIn */
    }

    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      devInfo("[Google][native] signIn cancelled");
      return { ok: false, cancelled: true, message: "cancelled" };
    }
    if (!isSuccessResponse(response)) {
      return { ok: false, message: "Google sign-in did not return a user." };
    }

    const idToken = response.data.idToken;
    devInfo("[Google][native] token received:", Boolean(idToken), "email:", response.data.user.email);
    if (!idToken) {
      return { ok: false, message: "Google did not return an identity token." };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) {
      devError("[Google][native] signInWithIdToken error:", error.message);
      return { ok: false, message: error.message };
    }

    devInfo("[Google][native] signInWithIdToken success");
    return { ok: true };
  } catch (e: unknown) {
    if (googleSignIn?.isErrorWithCode(e)) {
      if (e.code === googleSignIn.statusCodes.SIGN_IN_CANCELLED) {
        return { ok: false, cancelled: true, message: "cancelled" };
      }
      if (e.code === googleSignIn.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { ok: false, message: "Google Play Services are not available." };
      }
      if (e.code === googleSignIn.statusCodes.IN_PROGRESS) {
        return { ok: false, message: "Google sign-in is already in progress." };
      }
    }
    const message = e instanceof Error ? e.message : "Google sign-in failed.";
    devError("[Google][native] error:", message);
    return { ok: false, message };
  }
}
