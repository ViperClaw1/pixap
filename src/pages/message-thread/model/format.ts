export function peerFullName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}

export { formatRelativeLastSeen } from "@/shared/lib/formatRelativeTime";

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
