import { useMemo } from "react";
import { Platform, StyleSheet } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { ThemeMode } from "@/app/providers/ThemeProvider";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

/** Below this width, action rows use tighter padding so labels can wrap without ellipsis. */
export const PROFILE_COMPACT_WIDTH = 400;
/** Below this width, profile header avatar uses a smaller layout size. */
export const PROFILE_NARROW_WIDTH = 390;
export const PROFILE_AVATAR_SIZE = 56;
export const PROFILE_AVATAR_SIZE_NARROW = 48;
export const PROFILE_CARD_PADDING = 16;

export function resolveProfileAvatarSize(windowWidth: number): number {
  return windowWidth < PROFILE_NARROW_WIDTH ? PROFILE_AVATAR_SIZE_NARROW : PROFILE_AVATAR_SIZE;
}
const PROFILE_VERIFICATION_CONTROL_HEIGHT = 30;

export const profileStaticStyles = StyleSheet.create({
  root: {
    flex: 1,
  },

  createMenuBody: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  createOptionGrid: {
    flexDirection: "row",
    gap: 10,
  },

  createOptionCard: {
    flex: 1,
    minHeight: 124,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 12,
  },

  createOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },

  createOptionLabel: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },

  createOptionHint: {
    fontSize: 12,
    textAlign: "center",
  },

  createOptionLoading: {
    marginTop: 6,
  },

  createPostSheetBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 420,
  },

  postUploaderBox: {
    marginTop: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },

  postUploaderBoxError: {},

  postUploaderText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  postPhotosList: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  postPhotoItem: {
    position: "relative",
    width: 56,
    height: 56,
  },

  postPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },

  postPhotoRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  postPhotoCount: {
    fontSize: 12,
  },

  postRequiredHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },

  composerWrap: {
    marginTop: 12,
  },

  postPlaceSelectTrigger: {
    marginTop: 10,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  postPlaceSelectTriggerError: {},

  postPlaceSelectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  postPlaceSelectPlaceholder: {
    fontSize: 14,
    fontWeight: "500",
  },

  postPlaceOptionsWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },

  postPlaceOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  postPlaceOptionText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  createStoryLoadingOnlyWrap: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
  },

  createFlowBackBtn: {
    minHeight: 48,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flex: 1,
  },

  createFlowBackBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },

  createPostBackRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  createStoryActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  createStoryPublishBtn: {
    ...primaryPressableStyle,
    flex: 1,
    minHeight: 48,
    height: 48,
    borderRadius: 12,
    marginTop: 0,
  },

  createStoryPublishBtnText: {
    ...primaryPressableTextStyle,
    fontSize: 16,
  },

  createPostLoadingOnlyWrap: {
    minHeight: 420,
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  createPostLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 24,
  },

  createPostLoadingText: {
    fontSize: 13,
    fontWeight: "600",
  },

  card: {
    position: "relative",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
    padding: PROFILE_CARD_PADDING,
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  profileInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    paddingRight: 34,
  },

  profileInfoFullBleed: {
    marginRight: -34,
  },

  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    fontSize: 18,
    fontWeight: "700",
  },

  email: {
    marginTop: 2,
    fontSize: 13,
  },

  emailVerificationRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
    minWidth: 0,
  },

  emailBadge: {
    alignSelf: "flex-start",
    flexShrink: 0,
    height: PROFILE_VERIFICATION_CONTROL_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
  },

  emailBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
    minWidth: 0,
  },

  bookingCreditsBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  bookingCreditsBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  verifyBtn: {
    height: PROFILE_VERIFICATION_CONTROL_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
    minWidth: 58,
  },

  verifyBtnText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  settingsBtn: {
    position: "absolute",
    top: PROFILE_CARD_PADDING,
    right: PROFILE_CARD_PADDING,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },

  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: "center",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "700",
  },

  statLabel: {
    fontSize: 11,
  },

  bioCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },

  bioLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.25,
    marginBottom: 6,
  },

  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },

  suggestionsSection: {
    marginBottom: 16,
  },

  suggestionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  suggestionsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  suggestionsSubtitle: {
    fontSize: 12,
  },

  suggestionScrollContent: {
    paddingRight: 2,
    gap: 10,
  },

  suggestionCard: {
    width: 168,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },

  suggestionEmptyCard: {
    alignSelf: "stretch",
    width: "100%",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  suggestionAvatarWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: "hidden",
    alignSelf: "center",
  },

  suggestionName: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  suggestionReason: {
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
    minHeight: 16,
  },

  suggestionFollowBtn: {
    marginTop: 10,
          ...primaryPressableStyle,
    minHeight: 38,
    borderRadius: 10,
  },

  suggestionFollowBtnText: {
    ...primaryPressableTextStyle,
    fontSize: 14,
  },

  actionsCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    /** Android: `overflow: hidden` + borderRadius breaks hit-testing for bottom rows. */
    ...Platform.select({
      ios: { overflow: "hidden" as const },
      default: { overflow: "visible" as const },
    }),
  },

  link: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    ...Platform.select({
      android: {
        zIndex: 1,
        elevation: 0,
      },
      default: null,
    }),
  },

  linkCompact: {
    paddingHorizontal: 10,
    gap: 8,
  },

  linkLastInCard: {
    borderBottomWidth: 0,
  },

  linkIcon: {
    flexShrink: 0,
  },

  linkText: {
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },

  linkMenuBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  linkMenuBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  signOut: {
    ...primaryPressableStyle,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 10,
    minHeight: 44,
  },

  signOutText: {
    ...primaryPressableTextStyle,
    fontSize: 16,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "stretch",
  },

  modalContent: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 10,
    flexGrow: 0,
    flexShrink: 1,
  },

  modalContentLarge: {
    maxHeight: "75%",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
  },

  modalTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  closeBtn: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },

  closeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

export function profileThemeStyles(colors: ThemeColors, _mode: ThemeMode) {
  return {
    root: {
      backgroundColor: colors.background,
    },
    createOptionCard: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    createOptionRow: {
      borderBottomColor: colors.border,
    },
    createOptionLabel: {
      color: colors.text,
    },
    createOptionHint: {
      color: colors.textMuted,
    },
    postUploaderBox: {
      borderColor: colors.border,
    },
    postUploaderBoxError: {
      borderColor: colors.danger,
    },
    postUploaderText: {
      color: colors.textMuted,
    },
    postPhotoRemoveBtn: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    postPhotoCount: {
      color: colors.textMuted,
    },
    postRequiredHint: {
      color: colors.textMuted,
    },
    postPlaceSelectTrigger: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    postPlaceSelectTriggerError: {
      borderColor: colors.danger,
    },
    postPlaceSelectText: {
      color: colors.text,
    },
    postPlaceSelectPlaceholder: {
      color: colors.textMuted,
    },
    postPlaceOptionsWrap: {
      borderColor: colors.border,
    },
    postPlaceOption: {
      borderBottomColor: colors.border,
    },
    postPlaceOptionText: {
      color: colors.text,
    },
    createFlowBackBtn: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    createFlowBackBtnText: {
      color: colors.textMuted,
    },
    createPostLoadingText: {
      color: colors.textMuted,
    },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    avatarWrap: {
      backgroundColor: colors.surface,
    },
    name: {
      color: colors.text,
    },
    email: {
      color: colors.textMuted,
    },
    verifyBtn: {
      borderColor: colors.primary,
      backgroundColor: colors.background,
    },
    verifyBtnText: {
      color: colors.primary,
    },
    bookingCreditsBadge: {
      backgroundColor: colors.accentSurface,
      borderColor: colors.border,
    },
    bookingCreditsBadgeText: {
      color: colors.text,
    },
    settingsBtn: {
      borderColor: colors.border,
    },
    statCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    statValue: {
      color: colors.text,
    },
    statLabel: {
      color: colors.textMuted,
    },
    bioCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    bioLabel: {
      color: colors.textMuted,
    },
    bioText: {
      color: colors.text,
    },
    suggestionsTitle: {
      color: colors.text,
    },
    suggestionsSubtitle: {
      color: colors.textMuted,
    },
    suggestionCard: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    suggestionEmptyCard: {
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    suggestionAvatarWrap: {
      backgroundColor: colors.surface,
    },
    suggestionName: {
      color: colors.text,
    },
    suggestionReason: {
      color: colors.textMuted,
    },
    actionsCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    link: {
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    linkText: {
      color: colors.text,
    },
    linkMenuBadge: {
      backgroundColor: colors.primary,
    },
    linkMenuBadgeText: {
      color: colors.onPrimary,
    },
    modalBackdrop: {
      backgroundColor: colors.scrim,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    modalHeader: {
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
    },
    closeBtn: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    closeText: {
      color: colors.text,
    },
  } satisfies Partial<Record<keyof typeof profileStaticStyles, object>>;
}

export function useProfileStyles() {
  const themed = useThemeStyles(({ colors, mode }) => profileThemeStyles(colors, mode));
  return useMemo(() => mergeStaticAndThemed(profileStaticStyles, themed), [themed]);
}
