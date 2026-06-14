type Params = {
  isAuthenticated: boolean;
  dailyRecsEnabled: boolean;
  dailyRecsFetched: boolean;
  featuredLoading: boolean;
  recommendedLoading: boolean;
  hasFeatured: boolean;
  hasRecommended: boolean;
};

/** Keep hero skeleton until the final display source is known (avoids placeholder → fallback → recommendation flicker). */
export function isDailyPicksHeroLoading({
  isAuthenticated,
  dailyRecsEnabled,
  dailyRecsFetched,
  featuredLoading,
  recommendedLoading,
  hasFeatured,
  hasRecommended,
}: Params): boolean {
  if (isAuthenticated && dailyRecsEnabled) {
    return !dailyRecsFetched;
  }

  if (hasFeatured || hasRecommended) {
    return false;
  }

  return featuredLoading || recommendedLoading;
}
