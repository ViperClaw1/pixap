import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { LanguagePickerModal } from "@/shared/ui/app-header/LanguagePickerModal";

type AppHeaderProps = {
  title: string;
  leftIcon: keyof typeof Ionicons.glyphMap;
  onLeftPress: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
};

function AppHeaderComponent({ title, leftIcon, onLeftPress, rightIcon, onRightPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);
  const hasRightAction = Boolean(rightIcon && onRightPress);
  const titleInsetEnd = 12 + 34 + (hasRightAction ? 6 + 34 : 0) + 8;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 10), borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.row}>
        <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onLeftPress}>
          <Ionicons name={leftIcon} size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text, left: 56, right: titleInsetEnd }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rightActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("language.choose")}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => setLanguageOpen(true)}
          >
            <Ionicons name="language-outline" size={20} color={colors.text} />
          </Pressable>
          {hasRightAction ? (
            <Pressable style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={onRightPress}>
              <Ionicons name={rightIcon} size={20} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </View>
  );
}

export const AppHeader = memo(AppHeaderComponent);

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  title: {
    position: "absolute",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
});
