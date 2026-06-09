import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "search:recent";
const MAX_RECENT = 3;

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export async function saveRecentSearch(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return loadRecentSearches();
  const existing = await loadRecentSearches();
  const next = [trimmed, ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
