import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";
import { resolveProfileAvatarSize, useProfileStyles } from "./profileStyles";

/** Keep in sync with `profileStaticStyles` / `ProfilePage` layout. */
const SETTINGS_BTN_SIZE = 34;
const STAT_VALUE_H = 22;
const STAT_LABEL_H = 11;
const STAT_CARD_PADDING_V = 12;
const SUGGESTION_CARD_W = 168;
const SUGGESTION_AVATAR = 66;
const SUGGESTION_FOLLOW_H = 38;
const BIO_LABEL_H = 12;
const BIO_LINE_H = 14;
const LINK_ROW_H = 48;
const LINK_ICON = 20;
/** subscription + onboarding + trailing menu rows */
const ACTION_LINK_ROWS = 7;
const SIGN_OUT_H = 44;

type Props = {
  isCompact?: boolean;
};

function ProfilePageSkeletonInner({ isCompact = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useProfileStyles();
  const { width: windowWidth } = useStaticWindowSize();
  const profileAvatarSize = resolveProfileAvatarSize(windowWidth);
  const pagePadding = isCompact ? 12 : 16;
  const contentWidth = windowWidth - pagePadding * 2;
  const bioTextW = Math.max(120, contentWidth - 28);
  const suggestionInnerW = SUGGESTION_CARD_W - 24;
  const nameLineW = isCompact ? 132 : 156;
  const emailLineW = isCompact ? 168 : 196;

  return (
    <ShimmerProvider active>
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <ShimmerSurface
            width={profileAvatarSize}
            height={profileAvatarSize}
            borderRadius={profileAvatarSize / 2}
          />
          <View style={skeletonStyles.profileMeta}>
            <ShimmerSurface width={nameLineW} height={18} borderRadius={4} />
            <ShimmerSurface width={emailLineW} height={13} borderRadius={4} style={skeletonStyles.gapXs} />
            <ShimmerSurface width={128} height={28} borderRadius={999} style={skeletonStyles.gapSm} />
          </View>
          <ShimmerSurface
            width={SETTINGS_BTN_SIZE}
            height={SETTINGS_BTN_SIZE}
            borderRadius={SETTINGS_BTN_SIZE / 2}
          />
        </View>
        <View style={[skeletonStyles.subscriptionBlock, { borderTopColor: colors.border }]}>
          <ShimmerSurface width={200} height={16} borderRadius={4} />
          <ShimmerSurface width={148} height={12} borderRadius={4} style={skeletonStyles.gapXs} />
          <ShimmerSurface width={132} height={30} borderRadius={8} style={skeletonStyles.gapSm} />
        </View>
      </View>

      <StatRowSkeleton />
      <StatRowSkeleton />

      <View style={styles.suggestionsSection}>
        <View style={styles.suggestionsHeader}>
          <ShimmerSurface width={148} height={18} borderRadius={4} />
          <ShimmerSurface width={72} height={12} borderRadius={4} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScrollContent}>
          {Array.from({ length: 3 }).map((_, index) => (
            <View key={index} style={styles.suggestionCard}>
              <ShimmerSurface
                width={SUGGESTION_AVATAR}
                height={SUGGESTION_AVATAR}
                borderRadius={SUGGESTION_AVATAR / 2}
                style={skeletonStyles.suggestionAvatar}
              />
              <ShimmerSurface width={120} height={15} borderRadius={4} style={skeletonStyles.gapMd} />
              <ShimmerSurface width={96} height={12} borderRadius={4} style={skeletonStyles.gapXs} />
              <ShimmerSurface
                width={suggestionInnerW}
                height={SUGGESTION_FOLLOW_H}
                borderRadius={10}
                style={skeletonStyles.gapMd}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.bioCard}>
        <ShimmerSurface width={36} height={BIO_LABEL_H} borderRadius={4} />
        <ShimmerSurface width={bioTextW} height={BIO_LINE_H} borderRadius={4} style={skeletonStyles.gapSm} />
        <ShimmerSurface width={bioTextW * 0.88} height={BIO_LINE_H} borderRadius={4} style={skeletonStyles.gapXs} />
      </View>

      <View style={styles.actionsCard}>
        {Array.from({ length: ACTION_LINK_ROWS }).map((_, index) => (
          <View
            key={index}
            style={[
              isCompact ? [styles.link, styles.linkCompact] : styles.link,
              index === ACTION_LINK_ROWS - 1 ? styles.linkLastInCard : null,
            ]}
          >
            <ShimmerSurface width={LINK_ICON} height={LINK_ICON} borderRadius={4} />
            <ShimmerSurface width={index === 0 ? 168 : 132} height={14} borderRadius={4} style={skeletonStyles.linkText} />
            <ShimmerSurface width={18} height={18} borderRadius={4} />
          </View>
        ))}
      </View>

      <ShimmerSurface width={contentWidth} height={SIGN_OUT_H} borderRadius={10} style={skeletonStyles.signOut} />
    </ShimmerProvider>
  );
}

function StatRowSkeleton() {
  const styles = useProfileStyles();

  return (
    <View style={styles.statRow}>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={[styles.statCard, skeletonStyles.statCardInner]}>
          <ShimmerSurface width={40} height={STAT_VALUE_H} borderRadius={4} />
          <ShimmerSurface width={56} height={STAT_LABEL_H} borderRadius={4} style={skeletonStyles.gapXs} />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  profileMeta: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  gapXs: {
    marginTop: 4,
  },
  gapSm: {
    marginTop: 8,
  },
  gapMd: {
    marginTop: 10,
  },
  subscriptionBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  suggestionAvatar: {
    alignSelf: "center",
  },
  statCardInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: STAT_CARD_PADDING_V,
  },
  linkText: {
    flex: 1,
    minWidth: 0,
  },
  signOut: {
    marginTop: 16,
    marginBottom: 16,
  },
});

export const ProfilePageSkeleton = memo(ProfilePageSkeletonInner);
