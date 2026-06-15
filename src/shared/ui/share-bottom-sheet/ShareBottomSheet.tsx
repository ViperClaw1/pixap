import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { AppPopupModal } from "@/shared/ui/app-popup";
import type { AppPopupOptions } from "@/shared/ui/app-popup";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { PublicProfileItem } from "@/entities/user";

type Props = {
  visible: boolean;
  onClose: () => void;
  users: PublicProfileItem[];
  loading: boolean;
  searchValue: string;
  onChangeSearch: (value: string) => void;
  resolveAvatarUri: (value?: string | null) => string | null;
  /** Shared post id; required for post share actions. */
  sharePostId: string | null;
  /** Place id when sharing a place without a post. */
  sharePlaceId?: string | null;
  /** Story id when a place story was created for sharing. */
  shareStoryId?: string | null;
  /** True when the post has at least one image URL for story-from-post. */
  sharePostHasMedia: boolean;
  sharePlaceName: string;
  shareSending: boolean;
  /** Inline alert while the sheet stays open (from usePostShareSheet). */
  sheetAlert?: AppPopupOptions | null;
  onDismissSheetAlert?: () => void;
  onShowSheetAlert?: (options: AppPopupOptions) => void;
  /** Hide "Add to story" (e.g. place-only share from daily recommendations). */
  hideAddToStory?: boolean;
  onAddToStory: () => Promise<void>;
  onWhatsAppShare: (peerUserId: string) => Promise<void>;
  onSystemShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
};

function fullName(user: PublicProfileItem, fallback: string) {
  return `${user.first_name?.trim() ?? ""} ${user.last_name?.trim() ?? ""}`.trim() || fallback;
}

function chunkUsers<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

const USER_GRID_COLUMNS = 4;
const USER_GRID_GAP = 20;
const USER_AVATAR_INNER_RATIO = 0.92;
const USER_AVATAR_BORDER = 1.5;

/** Matches default react-native-toast-message visibility (4s). */
const COPY_LINK_FEEDBACK_MS = 4000;
const COPIED_COLOR = "#22c55e";
const SHARE_SHEET_HEIGHT_FRACTION = 0.72;
/** Caps iOS keyboard lift so the sheet header stays on screen (see PhoneInput picker). */
const IOS_KEYBOARD_TOP_GAP = 8;
const isIOS = Platform.OS === "ios";
const ACTION_COLORS = {
  story: { background: "#ec6544", icon: "#ffffff" },
  whatsapp: { background: "#25D366", icon: "#ffffff" },
  system: { background: "#7c3aed", icon: "#ffffff" },
  link: { background: "#2563eb", icon: "#ffffff" },
  copied: { background: COPIED_COLOR, icon: "#ffffff" },
} as const;

export function ShareBottomSheet({
  visible,
  onClose,
  users,
  loading,
  searchValue,
  onChangeSearch,
  resolveAvatarUri,
  sharePostId,
  sharePlaceId = null,
  shareStoryId = null,
  sharePostHasMedia,
  sharePlaceName,
  shareSending,
  sheetAlert,
  onDismissSheetAlert,
  onShowSheetAlert,
  hideAddToStory = false,
  onAddToStory,
  onWhatsAppShare,
  onSystemShare,
  onCopyLink,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);
  const userRows = useMemo(() => chunkUsers(users, USER_GRID_COLUMNS), [users]);

  useEffect(() => {
    if (!visible) {
      setSelectedUserId(null);
      setLinkCopied(false);
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
        copyFeedbackTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const hasSelectedUser = !!selectedUser;
  const shareTargetActive = !!(sharePostId || sharePlaceId || shareStoryId);
  const actionsEnabled = shareTargetActive && !shareSending;
  const canRunPlaceStoryPicker = Boolean(sharePlaceId && !sharePostId);
  const canRunAddStoryAction = actionsEnabled && (sharePostHasMedia || canRunPlaceStoryPicker);
  const chooseUserAlert = useMemo<AppPopupOptions>(
    () => ({
      title: t("shareSheet.chooseUserTitle"),
      message: t("shareSheet.chooseUserMessage"),
      variant: "alert",
      buttons: [{ text: t("common.ok") }],
    }),
    [t],
  );

  const requireSelectedUser = () => {
    if (hasSelectedUser) return true;
    onShowSheetAlert?.(chooseUserAlert);
    return false;
  };

  const handleWhatsAppPress = () => {
    if (!requireSelectedUser() || !selectedUser) return;
    void onWhatsAppShare(selectedUser.id);
  };

  const handleShareToPress = () => {
    if (!actionsEnabled) return;
    void onSystemShare();
  };

  const handleCopyLinkPress = async () => {
    if (!actionsEnabled || linkCopied) return;
    await onCopyLink();
    setLinkCopied(true);
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = setTimeout(() => {
      setLinkCopied(false);
      copyFeedbackTimerRef.current = null;
    }, COPY_LINK_FEEDBACK_MS);
  };

  const sheetAlertOverlay =
    sheetAlert && onDismissSheetAlert ? (
      <AppPopupModal
        visible
        embedded
        title={sheetAlert.title}
        message={sheetAlert.message}
        buttons={sheetAlert.buttons}
        variant={sheetAlert.variant}
        onClose={onDismissSheetAlert}
      />
    ) : null;

  const shareFooter =
    shareTargetActive ? (
      <View
        style={[
          styles.footer,
          { borderTopColor: colors.border },
          isIOS && { backgroundColor: colors.card },
        ]}
      >
        {sharePlaceName ? (
          <Text style={[styles.shareContext, { color: colors.textMuted }]}>
            {t("shareSheet.sharing", { name: sharePlaceName })}
          </Text>
        ) : null}
        <View style={styles.actionsRow}>
          {!hideAddToStory ? (
            <View style={styles.actionItem}>
              <Pressable
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: ACTION_COLORS.story.background,
                    borderColor: ACTION_COLORS.story.background,
                    opacity: canRunAddStoryAction ? 1 : 0.5,
                  },
                ]}
                onPress={() => void onAddToStory()}
                disabled={!canRunAddStoryAction}
              >
                <View style={styles.actionIconWrap}>
                  <Ionicons name="add-circle-outline" size={32} color={ACTION_COLORS.story.icon} />
                </View>
              </Pressable>
              <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                {t("shareSheet.addToStory")}
              </Text>
            </View>
          ) : null}
          <View style={styles.actionItem}>
            <Pressable
              style={[
                styles.actionCard,
                {
                  backgroundColor: ACTION_COLORS.whatsapp.background,
                  borderColor: ACTION_COLORS.whatsapp.background,
                  opacity: actionsEnabled ? 1 : 0.5,
                },
              ]}
              onPress={handleWhatsAppPress}
              disabled={!actionsEnabled}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="logo-whatsapp" size={32} color={ACTION_COLORS.whatsapp.icon} />
              </View>
            </Pressable>
            <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
              {t("shareSheet.whatsapp")}
            </Text>
          </View>
          <View style={styles.actionItem}>
            <Pressable
              style={[
                styles.actionCard,
                {
                  backgroundColor: ACTION_COLORS.system.background,
                  borderColor: ACTION_COLORS.system.background,
                  opacity: actionsEnabled ? 1 : 0.5,
                },
              ]}
              onPress={handleShareToPress}
              disabled={!actionsEnabled}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons name="share-social-outline" size={32} color={ACTION_COLORS.system.icon} />
              </View>
            </Pressable>
            <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
              {t("shareSheet.shareTo")}
            </Text>
          </View>
          <View style={styles.actionItem}>
            <Pressable
              style={[
                styles.actionCard,
                {
                  backgroundColor: linkCopied ? ACTION_COLORS.copied.background : ACTION_COLORS.link.background,
                  borderColor: linkCopied ? ACTION_COLORS.copied.background : ACTION_COLORS.link.background,
                  opacity: actionsEnabled ? 1 : 0.5,
                },
              ]}
              onPress={() => void handleCopyLinkPress()}
              disabled={!actionsEnabled || linkCopied}
            >
              <View style={styles.actionIconWrap}>
                <Ionicons
                  name={linkCopied ? "checkmark-circle" : "link-outline"}
                  size={32}
                  color={linkCopied ? ACTION_COLORS.copied.icon : ACTION_COLORS.link.icon}
                />
              </View>
            </Pressable>
            <Text
              style={[styles.actionLabel, { color: linkCopied ? COPIED_COLOR : colors.text }]}
              numberOfLines={1}
            >
              {linkCopied ? t("shareSheet.copied") : t("shareSheet.copyLink")}
            </Text>
          </View>
        </View>
      </View>
    ) : null;

  return (
    <BottomSheetPickerModal
      visible={visible}
      onClose={onClose}
      title={t("shareSheet.title")}
      overlay={sheetAlertOverlay}
      maxHeightFraction={SHARE_SHEET_HEIGHT_FRACTION}
      minHeightFraction={SHARE_SHEET_HEIGHT_FRACTION}
      fitContent
      bodyScrollEnabled={false}
      keyboardTopGap={isIOS ? IOS_KEYBOARD_TOP_GAP : undefined}
      footer={shareFooter}
    >
      <View style={[styles.body, isIOS && styles.bodyIOS]}>
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={searchValue}
            onChangeText={onChangeSearch}
            placeholder={t("shareSheet.searchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline={false}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={[styles.usersScroll, isIOS && styles.usersScrollIOS]}
            contentContainerStyle={styles.gridContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <View style={styles.grid}>
              {userRows.map((row, rowIndex) => (
                <View key={`share-user-row-${rowIndex}`} style={styles.gridRow}>
                  {Array.from({ length: USER_GRID_COLUMNS }).map((_, columnIndex) => {
                    const user = row[columnIndex];
                    if (!user) {
                      return <View key={`share-user-empty-${rowIndex}-${columnIndex}`} style={styles.gridCell} />;
                    }

                    const avatar = resolveAvatarUri(user.avatar_url);
                    const isSelected = user.id === selectedUserId;

                    return (
                      <View key={user.id} style={styles.gridCell}>
                        <Pressable
                          style={[
                            styles.userCard,
                            isSelected && {
                              backgroundColor: colors.accentSurface,
                              borderColor: colors.accent,
                            },
                          ]}
                          onPress={() =>
                            setSelectedUserId((prev) => (prev === user.id ? null : user.id))
                          }
                        >
                          <View style={styles.userAvatarShell}>
                            <View
                              style={[
                                styles.userAvatarWrap,
                                {
                                  borderColor: isSelected ? colors.accent : colors.border,
                                  borderWidth: isSelected ? 3 : USER_AVATAR_BORDER,
                                },
                              ]}
                            >
                              {avatar ? (
                                <SmartImage uri={avatar} style={styles.userAvatarImage} contentFit="cover" />
                              ) : (
                                <View style={[styles.userAvatarPlaceholder, { backgroundColor: colors.card }]}>
                                  <Ionicons name="person-outline" size={22} color={colors.text} />
                                </View>
                              )}
                            </View>
                            {isSelected ? (
                              <View
                                style={[
                                  styles.userSelectedBadge,
                                  {
                                    backgroundColor: colors.accent,
                                    borderColor: colors.card,
                                  },
                                ]}
                              >
                                <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                              </View>
                            ) : null}
                          </View>
                          <Text
                            style={[
                              styles.userName,
                              { color: isSelected ? colors.accent : colors.text },
                              isSelected && styles.userNameSelected,
                            ]}
                            numberOfLines={2}
                          >
                            {fullName(user, t("common.unknownUser"))}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </BottomSheetPickerModal>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    width: "100%",
    minWidth: 360,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bodyIOS: {
    overflow: "hidden",
  },
  searchWrap: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 0,
    paddingVertical: 0,
    lineHeight: 20,
    fontSize: 14,
    borderWidth: 0,
    backgroundColor: "transparent",
    textAlignVertical: "center",
  },
  centered: {
    flex: 1,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  usersScroll: {
    flex: 1,
    marginTop: 12,
  },
  usersScrollIOS: {
    overflow: "hidden",
  },
  gridContent: {
    paddingBottom: 8,
  },
  grid: {
    width: "100%",
    gap: USER_GRID_GAP,
  },
  gridRow: {
    flexDirection: "row",
    gap: USER_GRID_GAP,
    width: "100%",
  },
  gridCell: {
    flex: 1,
    minWidth: 0,
  },
  userCard: {
    width: "100%",
    alignItems: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    padding: 4,
  },
  userAvatarShell: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 6,
    position: "relative",
  },
  userAvatarWrap: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userAvatarImage: {
    width: `${USER_AVATAR_INNER_RATIO * 100}%`,
    height: `${USER_AVATAR_INNER_RATIO * 100}%`,
    borderRadius: 9999,
  },
  userAvatarPlaceholder: {
    width: `${USER_AVATAR_INNER_RATIO * 100}%`,
    height: `${USER_AVATAR_INNER_RATIO * 100}%`,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  userSelectedBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  userName: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
    width: "100%",
  },
  userNameSelected: {
    fontWeight: "800",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 14,
  },
  shareContext: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
    textAlign: "left",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
    paddingVertical: 2,
  },
  actionItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 2,
  },
  actionCard: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    padding: 10,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 2,
  },
});
