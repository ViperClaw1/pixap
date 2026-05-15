import type { StoryProfile } from "@/shared/model/types/stories";
import { profileDisplayName } from "@/shared/lib/profileDisplayName";

export { profileDisplayName };

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
