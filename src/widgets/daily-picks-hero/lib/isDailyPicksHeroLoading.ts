type Params = {
  isAuthenticated: boolean;
  dailyRecsFetched: boolean;
  featuredLoading: boolean;
  recommendedLoading: boolean;
  hasFeatured: boolean;
  hasRecommended: boolean;
};

/** Keep hero skeleton until the final display source is known (avoids placeholder → fallback → recommendation flicker). */
export function isDailyPicksHeroLoading({
  isAuthenticated,
  dailyRecsFetched,
  featuredLoading,
  recommendedLoading,
  hasFeatured,
  hasRecommended,
}: Params): boolean {
  if (isAuthenticated) {
    return !dailyRecsFetched;
  }

  if (hasFeatured || hasRecommended) {
    return false;
  }

  return featuredLoading || recommendedLoading;
}
