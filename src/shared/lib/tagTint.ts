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

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHex(hex: string): readonly [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ] as const;
}

function mixHex(from: string, to: string, ratio: number): string {
  const [fr, fg, fb] = parseHex(from);
  const [tr, tg, tb] = parseHex(to);
  const r = clampByte(fr + (tr - fr) * ratio);
  const g = clampByte(fg + (tg - fg) * ratio);
  const b = clampByte(fb + (tb - fb) * ratio);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Darker/brighter tag label on `${tint}33` pills — background tint stays unchanged. */
export function tagTextColorForTint(tint: string, isDark: boolean): string {
  return isDark ? mixHex(tint, "#ffffff", 0.22) : mixHex(tint, "#111111", 0.48);
}
