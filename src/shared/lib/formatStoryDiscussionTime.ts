export function formatStoryDiscussionTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMs = Date.now() - t;
  if (!Number.isFinite(diffMs) || diffMs < 0) return "";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
