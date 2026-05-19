import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
  onAddToStory: () => Promise<void>;
  onWhatsAppShare: (peerUserId: string) => Promise<void>;
  onSystemShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
};

function fullName(user: PublicProfileItem) {
  return `${user.first_name?.trim() ?? ""} ${user.last_name?.trim() ?? ""}`.trim() || "Unknown user";
}

const CHOOSE_USER_ALERT: AppPopupOptions = {
  title: "Choose a user",
  message: "Please choose a user to share with.",
  variant: "alert",
  buttons: [{ text: "OK" }],
};

/** Matches default react-native-toast-message visibility (4s). */
const COPY_LINK_FEEDBACK_MS = 4000;
const COPIED_COLOR = "#22c55e";
const SHARE_SHEET_HEIGHT_FRACTION = 0.6;

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
  onAddToStory,
  onWhatsAppShare,
  onSystemShare,
  onCopyLink,
}: Props) {
  const { colors } = useAppTheme();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);

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

  const requireSelectedUser = () => {
    if (hasSelectedUser) return true;
    onShowSheetAlert?.(CHOOSE_USER_ALERT);
    return false;
  };

  const handleWhatsAppPress = () => {
    if (!requireSelectedUser() || !selectedUser) return;
    void onWhatsAppShare(selectedUser.id);
  };

  const handleShareToPress = () => {
    if (!requireSelectedUser()) return;
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

  return (
    <BottomSheetPickerModal
      visible={visible}
      onClose={onClose}
      title="Share"
      overlay={sheetAlertOverlay}
      maxHeightFraction={SHARE_SHEET_HEIGHT_FRACTION}
      minHeightFraction={SHARE_SHEET_HEIGHT_FRACTION}
      fitContent
    >
      <View style={styles.root}>
        <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={searchValue}
            onChangeText={onChangeSearch}
            placeholder="Search"
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
          <View style={styles.grid}>
            {users.map((user) => {
              const avatar = resolveAvatarUri(user.avatar_url);
              const isSelected = user.id === selectedUserId;
              return (
                <Pressable key={user.id} style={styles.userCard} onPress={() => setSelectedUserId(user.id)}>
                  <View style={[styles.userAvatarWrap, { borderColor: isSelected ? colors.primary : colors.border }]}>
                    {avatar ? (
                      <SmartImage uri={avatar} style={styles.userAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.userAvatar, styles.userAvatarPlaceholder, { backgroundColor: colors.card }]}>
                        <Ionicons name="person-outline" size={28} color={colors.text} />
                      </View>
                    )}
                    {isSelected ? (
                      <View style={[styles.userSelectedBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.userName, { color: colors.text }]} numberOfLines={2}>
                    {fullName(user)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {shareTargetActive ? (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {sharePlaceName ? <Text style={[styles.shareContext, { color: colors.textMuted }]}>Sharing: {sharePlaceName}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsRow}>
              <View style={styles.actionItem}>
                <Pressable
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: canRunAddStoryAction ? 1 : 0.5 }]}
                  onPress={() => void onAddToStory()}
                  disabled={!canRunAddStoryAction}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                    <Ionicons name="add-circle-outline" size={32} color={colors.text} />
                  </View>
                </Pressable>
                <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                  Add to story
                </Text>
              </View>
              <View style={styles.actionItem}>
                <Pressable
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: actionsEnabled ? 1 : 0.5 }]}
                  onPress={handleWhatsAppPress}
                  disabled={!actionsEnabled}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                    <Ionicons name="logo-whatsapp" size={32} color={colors.text} />
                  </View>
                </Pressable>
                <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                  Whatsapp
                </Text>
              </View>
              <View style={styles.actionItem}>
                <Pressable
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: actionsEnabled ? 1 : 0.5 }]}
                  onPress={handleShareToPress}
                  disabled={!actionsEnabled}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                    <Ionicons name="share-social-outline" size={32} color={colors.text} />
                  </View>
                </Pressable>
                <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                  Share to
                </Text>
              </View>
              <View style={styles.actionItem}>
                <Pressable
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: linkCopied ? COPIED_COLOR : colors.border,
                      opacity: actionsEnabled ? 1 : 0.5,
                    },
                  ]}
                  onPress={() => void handleCopyLinkPress()}
                  disabled={!actionsEnabled || linkCopied}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                    <Ionicons
                      name={linkCopied ? "checkmark-circle" : "link-outline"}
                      size={32}
                      color={linkCopied ? COPIED_COLOR : colors.text}
                    />
                  </View>
                </Pressable>
                <Text
                  style={[styles.actionLabel, { color: linkCopied ? COPIED_COLOR : colors.text }]}
                  numberOfLines={1}
                >
                  {linkCopied ? "Copied" : "Copy link"}
                </Text>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </View>
    </BottomSheetPickerModal>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    minWidth: 360,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
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
    paddingVertical: 18,
    alignItems: "center",
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
  },
  userCard: {
    width: "33.33%",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  userAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  userAvatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  userSelectedBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 17,
  },
  footer: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingBottom: 4,
  },
  shareContext: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  actionsRow: {
    gap: 16,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  actionItem: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 2,
  },
  actionCard: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    padding: 6,
  },
  actionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 2,
  },
});
