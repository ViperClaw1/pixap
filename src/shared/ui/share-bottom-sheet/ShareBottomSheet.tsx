import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { PublicProfileItem } from "@/entities/user";

type Props = {
  visible: boolean;
  onClose: () => void;
  users: PublicProfileItem[];
  loading: boolean;
  searchValue: string;
  onChangeSearch: (value: string) => void;
  resolveAvatarUri: (value?: string | null) => string | null;
  /** Shared post id; required for actions. */
  sharePostId: string | null;
  /** True when the post has at least one image URL for story-from-post. */
  sharePostHasMedia: boolean;
  sharePlaceName: string;
  shareSending: boolean;
  onAddToStory: () => Promise<void>;
  onWhatsAppShare: (peerUserId: string) => Promise<void>;
  onSystemShare: () => Promise<void>;
  onCopyLink: () => Promise<void>;
};

function fullName(user: PublicProfileItem) {
  return `${user.first_name?.trim() ?? ""} ${user.last_name?.trim() ?? ""}`.trim() || "Unknown user";
}

export function ShareBottomSheet({
  visible,
  onClose,
  users,
  loading,
  searchValue,
  onChangeSearch,
  resolveAvatarUri,
  sharePostId,
  sharePostHasMedia,
  sharePlaceName,
  shareSending,
  onAddToStory,
  onWhatsAppShare,
  onSystemShare,
  onCopyLink,
}: Props) {
  const { colors } = useAppTheme();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);

  useEffect(() => {
    if (!visible) {
      setSelectedUserId(null);
    }
  }, [visible]);

  const hasSelectedUser = !!selectedUser;
  const canRunUserAction = !!sharePostId && hasSelectedUser && !shareSending;
  const canRunAddStoryAction = !!sharePostId && sharePostHasMedia && hasSelectedUser && !shareSending;
  const canRunGlobalAction = !!sharePostId && hasSelectedUser && !shareSending;

  return (
    <BottomSheetPickerModal visible={visible} onClose={onClose} title="Share">
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

        {sharePostId ? (
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
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: canRunUserAction ? 1 : 0.5 }]}
                  onPress={() => selectedUser && void onWhatsAppShare(selectedUser.id)}
                  disabled={!canRunUserAction}
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
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: canRunGlobalAction ? 1 : 0.5 }]}
                  onPress={() => void onSystemShare()}
                  disabled={!canRunGlobalAction}
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
                  style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: canRunGlobalAction ? 1 : 0.5 }]}
                  onPress={() => void onCopyLink()}
                  disabled={!canRunGlobalAction}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.background }]}>
                    <Ionicons name="link-outline" size={32} color={colors.text} />
                  </View>
                </Pressable>
                <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
                  Copy link
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
