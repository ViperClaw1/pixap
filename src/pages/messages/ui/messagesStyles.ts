import { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

/** Page content width below which people-row layout switches to compact. */
export const MESSAGES_COMPACT_WIDTH = 400;

export const messagesStaticStyles = StyleSheet.create({
        root: {
          flex: 1,
        },

  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },

        searchWrap: {
          marginTop: 14,
          height: 48,
          borderRadius: 14,
          borderWidth: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOpacity: 0.02,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },

        searchInput: {
          flex: 1,
          fontSize: 15,
          marginLeft: 8,
        },

        sectionHeader: {
          marginTop: 22,
          marginBottom: 10,
        },

        sectionTitle: {
          fontSize: 18,
          fontWeight: "700",
          letterSpacing: -0.2,
        },

        card: {
          borderRadius: 16,
          borderWidth: 1,
          padding: 11,
          marginBottom: 9,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          shadowColor: "#000",
          shadowOpacity: 0.02,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 1,
        },

        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
        },

        cardMain: {
          flex: 1,
          minWidth: 0,
          justifyContent: "center",
        },

        rowBetween: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        },

        title: {
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: -0.1,
        },

        chatTitle: {
          flex: 1,
        },

        subtitle: {
          marginTop: 4,
          fontSize: 13,
          lineHeight: 16,
        },

        subtitleTyping: {
          fontStyle: "italic",
        },

        time: {
          fontSize: 12,
          fontWeight: "600",
        },

        username: {
          marginTop: 2,
          fontSize: 12,
        },

        userMetaRow: {
          marginTop: 2,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },

        followedBadge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 999,
          borderWidth: 1,
        },

        followedBadgeText: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          textTransform: "uppercase",
        },

        actionsWrap: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        },

        threadActionsWrap: {
          marginLeft: 8,
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
        },

        threadReadIndicator: {
          minHeight: 16,
          alignItems: "center",
          justifyContent: "center",
        },

        iconActionBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },

        followBtn: {
          borderWidth: 1,
        },

        chatBtn: {
          borderWidth: 1,
        },

        swipeActionWrap: {
          justifyContent: "center",
          paddingLeft: 8,
        },

        swipeActionBtn: {
          width: 52,
          height: 52,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },

        swipeFollowBtn: {},

        swipeChatBtn: {},

        swipeDeleteBtn: {},

        skeletonWrap: {
          gap: 10,
        },

        skeletonCard: {
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 14,
          overflow: "hidden",
          padding: 12,
          paddingBottom: 12,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },

        skeletonAvatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
        },

        skeletonMain: {
          flex: 1,
          gap: 8,
        },

        skeletonLineLg: {
          height: 12,
          width: "65%",
          borderRadius: 10,
        },

        skeletonLineMd: {
          height: 10,
          width: "45%",
          borderRadius: 10,
          opacity: 0.7,
        },

        skeletonActions: {
          flexDirection: "row",
          gap: 10,
          marginLeft: "auto",
        },

        skeletonCircle: {
          width: 44,
          height: 44,
          borderRadius: 22,
        },

        empty: {
          fontSize: 13,
          textAlign: "center",
          marginTop: 14,
        },

        contentCompact: {
          paddingHorizontal: 12,
        },

        cardCompact: {
          padding: 8,
          gap: 8,
          marginBottom: 8,
        },

        avatarCompact: {
          width: 40,
          height: 40,
          borderRadius: 20,
        },

        titleCompact: {
          fontSize: 14,
        },

        usernameCompact: {
          fontSize: 11,
        },

        userMetaRowCompact: {
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 3,
        },

        followedBadgeCompact: {
          paddingHorizontal: 6,
          paddingVertical: 2,
        },

        followedBadgeTextCompact: {
          fontSize: 9,
          letterSpacing: 0.1,
        },

        actionsWrapCompact: {
          gap: 6,
          flexShrink: 0,
        },

        iconActionBtnCompact: {
          width: 36,
          height: 36,
          borderRadius: 18,
        },

        swipeActionBtnCompact: {
          width: 44,
          height: 44,
        },

        skeletonCardCompact: {
          padding: 8,
          gap: 8,
        },

        supportCard: {
          borderRadius: 14,
          borderWidth: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },

        supportCardCompact: {
          paddingVertical: 8,
          paddingHorizontal: 10,
          marginBottom: 10,
          gap: 8,
        },

        supportTicketCard: {
          borderRadius: 14,
          borderWidth: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },

        supportTicketCardCompact: {
          paddingVertical: 8,
          paddingHorizontal: 10,
          gap: 8,
        },

        supportIconWrap: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },

        supportIconWrapCompact: {
          width: 36,
          height: 36,
          borderRadius: 18,
        },

        supportMain: {
          flex: 1,
          minWidth: 0,
          justifyContent: "center",
          gap: 2,
        },

        supportTitle: {
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: -0.1,
        },

        supportTitleCompact: {
          fontSize: 14,
        },

        supportSubtitle: {
          fontSize: 12,
          lineHeight: 15,
        },

        supportSubtitleCompact: {
          fontSize: 11,
          lineHeight: 14,
        },

        supportActionBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },

        supportActionBtnCompact: {
          width: 32,
          height: 32,
          borderRadius: 16,
        },

        supportSection: {
          marginBottom: 12,
          gap: 6,
        },

        supportSectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        },

        supportSectionIconWrap: {
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },

        supportSectionTitle: {
          fontSize: 15,
          fontWeight: "700",
          letterSpacing: -0.1,
        },

        supportSectionEmpty: {
          fontSize: 12,
          lineHeight: 16,
          paddingVertical: 4,
          paddingHorizontal: 2,
        },

        supportTicketAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          flexShrink: 0,
        },

        supportTicketAvatarCompact: {
          width: 36,
          height: 36,
          borderRadius: 18,
        },

        supportTicketMeta: {
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4,
          flexShrink: 0,
        },

        supportTicketTime: {
          fontSize: 11,
          lineHeight: 13,
        },

        supportTicketUnread: {
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          paddingHorizontal: 5,
          alignItems: "center",
          justifyContent: "center",
        },

        supportTicketUnreadText: {
          fontSize: 11,
          fontWeight: "700",
        },
});

export function messagesThemeStyles(colors: ThemeColors, bottomInset: number) {
  return {
    root: {
      backgroundColor: colors.background,
    },
    searchWrap: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: colors.shadow,
    },
    searchInput: {
      color: colors.text,
    },
    sectionTitle: {
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: colors.shadow,
    },
    avatar: {
      backgroundColor: colors.surface,
    },
    title: {
      color: colors.text,
    },
    subtitle: {
      color: colors.textMuted,
    },
    subtitleTyping: {
      color: colors.primary,
    },
    time: {
      color: colors.textMuted,
    },
    username: {
      color: colors.textMuted,
    },
    swipeActionBtn: { shadowColor: colors.shadow },
    followedBadge: {
      backgroundColor: colors.accentSurface,
      borderColor: colors.accent,
    },
    followedBadgeText: {
      color: colors.accent,
    },
    iconActionBtn: {
      backgroundColor: colors.surface,
    },
    followBtn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chatBtn: {
      backgroundColor: colors.actionMuted,
      borderColor: colors.accent,
    },
    swipeFollowBtn: {
      backgroundColor: colors.accent,
    },
    swipeChatBtn: {
      backgroundColor: colors.actionMuted,
    },
    swipeDeleteBtn: {
      backgroundColor: colors.danger,
    },
    skeletonCard: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    skeletonAvatar: {
      backgroundColor: colors.surface,
    },
    skeletonLineLg: {
      backgroundColor: colors.surface,
    },
    skeletonLineMd: {
      backgroundColor: colors.surface,
    },
    skeletonCircle: {
      backgroundColor: colors.surface,
    },
    empty: {
      color: colors.textMuted,
    },
    supportCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    supportTicketCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    supportIconWrap: {
      backgroundColor: colors.accent,
    },
    supportTitle: {
      color: colors.text,
    },
    supportSubtitle: {
      color: colors.textMuted,
    },
    supportActionBtn: {
      backgroundColor: colors.actionMuted,
      borderColor: colors.accent,
      borderWidth: 1,
    },
    supportTicketTime: {
      color: colors.textMuted,
    },
    content: { paddingBottom: Math.max(bottomInset, 20) },
  } satisfies Partial<Record<keyof typeof messagesStaticStyles, object>>;
}

export function useMessagesStyles(bottomInset: number) {
  const themed = useThemeStyles(
    ({ colors }) => messagesThemeStyles(colors, bottomInset),
    [bottomInset],
  );
  return useMemo(() => mergeStaticAndThemed(messagesStaticStyles, themed), [themed]);
}
