export type MentionProfile = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** Instagram-style @tag for replies (username when set, else first+last slug). */
export function profileMentionTag(profile: MentionProfile | null | undefined): string {
  if (!profile) return "@user";
  const raw = profile.username?.trim();
  if (raw) {
    const clean = raw.replace(/^@/, "");
    return `@${clean}`;
  }
  const first = (profile.first_name ?? "").trim();
  const last = (profile.last_name ?? "").trim();
  const slug = `${first}${last}`.replace(/\s+/g, "").toLowerCase();
  return slug ? `@${slug}` : "@user";
}
