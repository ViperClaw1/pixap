import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserPreferencesPatch } from "@/entities/user-preferences";

const KEY = "@pixapp/onboarding_draft_v1";

export async function saveOnboardingDraft(patch: UserPreferencesPatch): Promise<void> {
  try {
    const existing = await loadOnboardingDraft();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...existing, ...patch, savedAt: Date.now() }));
  } catch {
    /* ignore */
  }
}

export async function loadOnboardingDraft(): Promise<UserPreferencesPatch & { savedAt?: number }> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UserPreferencesPatch & { savedAt?: number };
  } catch {
    return {};
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
