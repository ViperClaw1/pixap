import Constants from "expo-constants";
import { env } from "@/shared/lib/env";
import { isGoogleSignInNativeModuleLinked } from "./isGoogleSignInNativeModuleLinked";

/** Native module in binary + Web client ID configured; not Expo Go. */
export function isNativeGoogleSignInAvailable(): boolean {
  if (Constants.appOwnership === "expo") return false;
  if (!isGoogleSignInNativeModuleLinked()) return false;
  return Boolean(env.googleWebClientId?.trim());
}
