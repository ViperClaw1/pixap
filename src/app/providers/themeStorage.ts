import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemeMode } from "@/app/providers/ThemeProvider";

export const THEME_MODE_STORAGE_KEY = "@pixapp/ui_theme_mode";

export function parsePersistedThemeMode(raw: string | null): ThemeMode | null {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return null;
}

export async function loadPersistedThemeMode(): Promise<ThemeMode> {
  try {
    const raw = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    return parsePersistedThemeMode(raw) ?? "system";
  } catch {
    return "system";
  }
}
