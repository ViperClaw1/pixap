export function formatReportPartyName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  username: string | null | undefined,
  fallback: string,
): string {
  const full = `${firstName?.trim() ?? ""} ${lastName?.trim() ?? ""}`.trim();
  if (full) return full;
  const handle = username?.trim();
  if (handle) return `@${handle}`;
  return fallback;
}
