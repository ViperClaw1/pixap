import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "@pixapp/trial_banner_dismissed_v1";

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

export async function hasTrialBannerDismissed(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    return false;
  }
}

export async function setTrialBannerDismissed(userId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), "1");
}
