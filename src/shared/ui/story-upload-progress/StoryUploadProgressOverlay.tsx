import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { StoryUploadStage } from "@/entities/story/api/useBatchCreateStoryFromPicker";

type Props = {
  visible: boolean;
  stage: StoryUploadStage;
};

export function StoryUploadProgressOverlay({ visible, stage }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  if (!visible || stage === "idle") return null;

  const label =
    stage === "uploading_photos"
      ? t("profile.create.uploadingPhotos")
      : t("profile.create.publishingStory");

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
});
