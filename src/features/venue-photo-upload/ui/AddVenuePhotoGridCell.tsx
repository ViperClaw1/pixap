import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";

const TILE_BG_LIGHT = "#e8e8e8";
const TILE_BG_DARK = "#242424";

const ICON_GRADIENT_LIGHT = ["#ff6b4a", "#ec6544", "#db2777"] as const;
const ICON_GRADIENT_DARK = ["#ff7a59", "#ea580c", "#be185d"] as const;

type Props = {
  tileWidth: number;
  tileHeight: number;
  uploading?: boolean;
  onPress: () => void;
};

export function AddVenuePhotoGridCell({ tileWidth, tileHeight, uploading = false, onPress }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={uploading}
      accessibilityRole="button"
      accessibilityLabel={t("placePhotoGrid.addPhotoA11y")}
      style={({ pressed }) => [
        styles.root,
        {
          width: tileWidth,
          height: tileHeight,
          backgroundColor: isDark ? TILE_BG_DARK : TILE_BG_LIGHT,
          opacity: pressed && !uploading ? 0.88 : 1,
        },
      ]}
    >
      {uploading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <LinearGradient
            colors={isDark ? [...ICON_GRADIENT_DARK] : [...ICON_GRADIENT_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="add" size={28} color="#ffffff" />
          </LinearGradient>
          <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
            {t("placePhotoGrid.addPhoto")}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
});
