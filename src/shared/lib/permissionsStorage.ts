import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@pixapp/permissions_intro_v1";

export async function hasSeenPermissionsIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return true;
  }
}

export async function setSeenPermissionsIntro(): Promise<void> {
  await AsyncStorage.setItem(KEY, "1");
}
