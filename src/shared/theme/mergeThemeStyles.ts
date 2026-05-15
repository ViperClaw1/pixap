import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

type RNStyle = ViewStyle | TextStyle | ImageStyle;

/**
 * Merges module-level StyleSheet keys with plain theme overrides for prop drilling
 * (e.g. cart row components that expect one style object per key).
 */
export function mergeStaticAndThemed<S extends Record<string, RNStyle>>(
  staticPart: S,
  themedPart: Partial<Record<keyof S, RNStyle>>,
): S {
  const out = { ...staticPart };
  for (const key of Object.keys(themedPart) as (keyof S)[]) {
    const themed = themedPart[key];
    if (!themed) continue;
    const base = staticPart[key];
    out[key] = (base ? [base, themed] : themed) as S[keyof S];
  }
  return out;
}
