import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "@pixapp/paywall_tour_seen_v2";

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

export async function hasSeenPaywallTour(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    return true;
  }
}

export async function setSeenPaywallTour(userId: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), "1");
}
