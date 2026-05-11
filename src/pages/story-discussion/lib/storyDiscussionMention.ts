import type { StoryProfile } from "@/types/stories";

/** Display name for story discussion (prefer public username). */
export function profileDisplayName(profile: StoryProfile | null): string {
  if (!profile) return "User";
  const u = profile.username?.trim();
  if (u) return u.replace(/^@/, "");
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || "User";
}

/** Instagram-style @tag for replies (lowercase handle when no username). */
export function profileMentionTag(profile: StoryProfile | null): string {
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
