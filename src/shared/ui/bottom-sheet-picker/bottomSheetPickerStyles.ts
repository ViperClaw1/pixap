import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

export const bottomSheetPickerStaticStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabberHit: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    opacity: 0.55,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    textAlign: "center",
  },
});

export function bottomSheetPickerThemeStyles(
  colors: ThemeColors,
  sheetMaxHeight: number,
  bottomInset: number,
  isAndroid: boolean,
  isKeyboardOpen: boolean,
) {
  return {
    backdrop: {
      backgroundColor: colors.scrim,
    },
    sheet: {
      maxHeight: sheetMaxHeight,
      backgroundColor: colors.card,
      borderColor: colors.border,
      paddingBottom: isAndroid ? Math.max(bottomInset, 10) : isKeyboardOpen ? 0 : Math.max(bottomInset, 10),
    },
    grabber: { backgroundColor: colors.textMuted },
    title: {
      color: colors.text,
      borderBottomColor: colors.border,
    },
  } satisfies Partial<Record<keyof typeof bottomSheetPickerStaticStyles, object>>;
}

export function useBottomSheetPickerStyles(
  sheetMaxHeight: number,
  bottomInset: number,
  isAndroid: boolean,
  isKeyboardOpen: boolean,
) {
  const themed = useThemeStyles(
    ({ colors }) => bottomSheetPickerThemeStyles(colors, sheetMaxHeight, bottomInset, isAndroid, isKeyboardOpen),
    [sheetMaxHeight, bottomInset, isAndroid, isKeyboardOpen],
  );
  return useMemo(() => mergeStaticAndThemed(bottomSheetPickerStaticStyles, themed), [themed]);
}
