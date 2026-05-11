import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetPickerModal } from "@/shared/ui/bottom-sheet-picker/BottomSheetPickerModal";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { PublicProfileItem } from "@/entities/user";
import { SHARED_PRESSABLE_HEIGHT, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";

type Props = {
  visible: boolean;
  onClose: () => void;
  users: PublicProfileItem[];
  loading: boolean;
  searchValue: string;
  onChangeSearch: (value: string) => void;
  resolveAvatarUri: (value?: string | null) => string | null;
  /** Business card / place id for the shared post; required to send. */
  sharePlaceId: string | null;
  sharePlaceName: string;
  shareSending: boolean;
  onShareSend: (payload: { peerUserId: string; message: string }) => Promise<void>;
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
  sharePlaceId,
  sharePlaceName,
  shareSending,
  onShareSend,
}: Props) {
  const { colors } = useAppTheme();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const selectedUser = useMemo(() => users.find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users]);

  useEffect(() => {
    if (!visible) {
      setMessage("");
      setSelectedUserId(null);
    }
  }, [visible]);

  const canSend = !!sharePlaceId && !!selectedUser && !shareSending;

  const submit = async () => {
    if (!sharePlaceId || !selectedUser || shareSending) return;
    await onShareSend({ peerUserId: selectedUser.id, message: message.trim() });
    setMessage("");
  };

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

        {selectedUser && sharePlaceId ? (
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {sharePlaceName ? (
              <Text style={[styles.shareContext, { color: colors.textMuted }]} numberOfLines={2}>
                Sharing: {sharePlaceName}
              </Text>
            ) : null}
            <View style={styles.composerContainer}>
              <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <RichTextarea
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Write a message..."
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.composerInput,
                    {
                      color: colors.text,
                    },
                  ]}
                />
              </View>
              <Pressable
                style={[styles.sendBtn, { opacity: canSend ? 1 : 0.55 }]}
                onPress={() => void submit()}
                disabled={!canSend}
              >
                {shareSending ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <FontAwesome name="paper-plane" size={18} style={styles.sendIcon} />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </BottomSheetPickerModal>
  );
}

const styles = StyleSheet.create({
  root: {
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
    marginBottom: 10,
    lineHeight: 18,
  },
  composerContainer: {
    marginTop: 2,
    position: "relative",
  },
  composer: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: SHARED_PRESSABLE_HEIGHT,
  },
  composerInput: {
    minHeight: SHARED_PRESSABLE_HEIGHT,
    maxHeight: 120,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 64,
    fontSize: 14,
  },
  sendBtn: {
    ...primaryPressableStyle,
    position: "absolute",
    right: 8,
    bottom: 8,
    minWidth: 42,
    width: 42,
    minHeight: 42,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 0,
  },
  sendIcon: {
    ...primaryPressableTextStyle,
    lineHeight: 18,
  },
});
