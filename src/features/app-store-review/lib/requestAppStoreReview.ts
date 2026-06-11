import { AppState } from "react-native";
import * as StoreReview from "expo-store-review";

export async function requestAppStoreReview(): Promise<boolean> {
  if (AppState.currentState !== "active") return false;

  try {
    if (!(await StoreReview.hasAction())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
