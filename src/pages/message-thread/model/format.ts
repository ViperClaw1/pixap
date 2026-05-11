export function peerFullName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

export function formatRelativeLastSeen(value?: string | null) {
  if (!value) return "last seen recently";
  const createdAtMs = new Date(value).getTime();
  if (Number.isNaN(createdAtMs)) return "last seen recently";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  if (diffSeconds < 60) return `last seen ${diffSeconds} seconds ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `last seen ${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `last seen ${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `last seen ${diffDays} days ago`;
}

export function messageDateGroupLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (target === startOfToday) return "Today";
  if (target === startOfYesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "2-digit" });
}
