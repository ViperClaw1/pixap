import type { MessageParticipantProfile } from "@/shared/model/types/messages";

export function parseInboxParticipants(raw: unknown): MessageParticipantProfile[] {
  if (!Array.isArray(raw)) return [];
  const profiles: MessageParticipantProfile[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = row.id;
    if (typeof id !== "string") continue;
    profiles.push({
      id,
      first_name: typeof row.first_name === "string" ? row.first_name : null,
      last_name: typeof row.last_name === "string" ? row.last_name : null,
      avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
      username: typeof row.username === "string" ? row.username : null,
    });
  }
  return profiles;
}
