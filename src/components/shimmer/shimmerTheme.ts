/** Skeleton / shimmer colors derived from app light-dark mode (not in palette tokens). */
export function getSkeletonShimmerColors(isDark: boolean) {
  if (isDark) {
    return {
      base: "#262626",
      peak: "rgba(255,255,255,0.14)",
    };
  }
  return {
    base: "#e8e8e8",
    peak: "rgba(255,255,255,0.95)",
  };
}
