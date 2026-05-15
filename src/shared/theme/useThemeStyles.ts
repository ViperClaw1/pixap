import { useMemo } from "react";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";

export type ThemeStyleContext = {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
};

/**
 * Theme-dependent styles as plain objects (no StyleSheet.create).
 * Pair with module-level StyleSheet.create for layout-only keys.
 */
export function useThemeStyles<T extends Record<string, object>>(
  factory: (theme: ThemeStyleContext) => T,
  extraDeps: readonly unknown[] = [],
): T {
  const { colors, isDark, mode } = useAppTheme();
  return useMemo(
    () => factory({ colors, isDark, mode }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraDeps supplied by call site
    [colors, isDark, mode, ...extraDeps],
  );
}
