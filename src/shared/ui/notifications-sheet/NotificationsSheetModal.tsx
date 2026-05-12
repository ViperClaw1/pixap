import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useMarkAsRead, useNotifications } from "@/entities/notification";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
};

export function NotificationsSheetModal({ visible, onClose, title }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const resolvedTitle = title ?? t("notifications.sheetTitle");

  const styles = StyleSheet.create({
    body: { paddingHorizontal: 4, paddingBottom: 12 },
    empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 20 },
    card: {
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardTextBlock: { flex: 1, minWidth: 0 },
    text: { color: colors.text, fontSize: 14 },
    date: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
    readIconWrap: { width: 28, alignItems: "center", justifyContent: "center" },
    readIcon: { opacity: 0.45 },
  });

  return (
    <BottomSheetPickerModal visible={visible} onClose={onClose} title={resolvedTitle} maxHeightFraction={0.75}>
      <View style={styles.body}>
        {isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
        {!isLoading && notifications.length === 0 ? (
          <Text style={styles.empty}>{t("notifications.empty")}</Text>
        ) : null}
        {notifications.map((n) => (
          <Pressable
            key={n.id}
            style={styles.card}
            onPress={() => {
              if (!n.is_read && !markAsRead.isPending) {
                void markAsRead.mutateAsync(n.id);
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: !n.is_read }}
            accessibilityLabel={n.is_read ? n.text : `${n.text}, ${t("notifications.unreadA11y")}`}
          >
            <View style={styles.cardTextBlock}>
              <Text style={styles.text}>{n.text}</Text>
              <Text style={styles.date}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.readIconWrap}>
              {n.is_read ? (
                <Ionicons name="checkmark-done-outline" size={20} color={colors.textMuted} style={styles.readIcon} />
              ) : (
                <Ionicons name="notifications" size={18} color={colors.primary} />
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheetPickerModal>
  );
}
