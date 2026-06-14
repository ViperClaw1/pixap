import Constants from "expo-constants";
import { Platform } from "react-native";

/** Production release — one app-side request on iOS; Android allows retry after ~90 days. */
export function isProductionReviewRuntime(): boolean {
  if (__DEV__) return false;

  if (Platform.OS === "ios") {
    return Constants.appOwnership !== "expo";
  }

  if (Platform.OS === "android") {
    return true;
  }

  return false;
}
