import type { CrowdLevel, VenueLiveCrowd } from "../model/types";

const CROWD_LEVELS: CrowdLevel[] = ["empty", "low", "medium", "busy", "packed"];

function isCrowdLevel(value: unknown): value is CrowdLevel {
  return typeof value === "string" && CROWD_LEVELS.includes(value as CrowdLevel);
}

function toNonNegativeInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function parseVenueLiveCrowd(data: unknown): VenueLiveCrowd {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  const scoreRaw = typeof row.crowd_score === "number" ? row.crowd_score : Number(row.crowd_score);
  const crowd_score = Number.isFinite(scoreRaw)
    ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
    : 0;

  const crowd_level = isCrowdLevel(row.crowd_level) ? row.crowd_level : "empty";

  return {
    crowd_score,
    crowd_level,
    checkins_last_hour: toNonNegativeInt(row.checkins_last_hour),
    active_bookings: toNonNegativeInt(row.active_bookings),
    stories_velocity: toNonNegativeInt(row.stories_velocity),
  };
}
