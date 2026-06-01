export const TAG_TINTS = [
  "#5b4b8a",
  "#8a4b6a",
  "#4b8a6a",
  "#6a6a4b",
  "#4b6a8a",
  "#9333ea",
  "#db2777",
  "#ea580c",
] as const;

export function tintForTagKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % TAG_TINTS.length;
  }
  return TAG_TINTS[hash] ?? TAG_TINTS[0];
}
