import { TurboModuleRegistry } from "react-native";

/** True when the dev/production binary includes @react-native-google-signin (not Expo Go / stale build). */
export function isGoogleSignInNativeModuleLinked(): boolean {
  return TurboModuleRegistry.get("RNGoogleSignin") != null;
}
