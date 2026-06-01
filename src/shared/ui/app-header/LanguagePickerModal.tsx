import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { APP_LANGUAGES, type AppLanguage, i18n, switchLanguage } from "@/shared/lib/i18n";

type LanguagePickerModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function LanguagePickerModal({ visible, onClose }: LanguagePickerModalProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const current = i18n.resolvedLanguage ?? i18n.language;

  const pick = (lng: AppLanguage) => {
    void switchLanguage(lng);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.text }]}>{t("language.choose")}</Text>
          <View style={styles.list}>
            {APP_LANGUAGES.map((lng) => {
              const active = current === lng || current.startsWith(`${lng}-`);
              return (
                <Pressable
                  key={lng}
                  onPress={() => pick(lng)}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.label, { color: colors.text }]}>{t(`language.${lng}`)}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  list: {
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
});
