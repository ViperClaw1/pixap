import Constants from "expo-constants";

/** Production / TestFlight — one app-side request; Apple rate-limits the native sheet. */
export function isProductionAppStoreReviewRuntime(): boolean {
  return !__DEV__ && Constants.appOwnership !== "expo";
}
