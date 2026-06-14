import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@pixapp/app_launched_v1";

export async function hasLaunchedAppBefore(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return true;
  }
}

export async function markAppLaunched(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
