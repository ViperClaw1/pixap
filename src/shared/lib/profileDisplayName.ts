import type { StoryProfile } from "@/shared/model/types/stories";

/** Public label for story bubbles and similar UI (prefer username over full name). */
export function profileDisplayName(profile: StoryProfile | null | undefined): string {
  if (!profile) return "User";
  const username = profile.username?.trim();
  if (username) return username.replace(/^@/, "");
  const first = profile.first_name?.trim() ?? "";
  const last = profile.last_name?.trim() ?? "";
  const combined = `${first} ${last}`.trim();
  return combined || "User";
}
