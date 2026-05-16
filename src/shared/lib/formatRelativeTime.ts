export type RelativeTimeStyle = "long" | "compact" | "short";

export type FormatRelativeTimeOptions = {
  /** `long` — "5 minutes ago" (feed, comments); `compact` — "5m ago" (inbox); `short` — "5m" / locale date (story thread). */
  style?: RelativeTimeStyle;
  prefix?: string;
  empty?: string;
  /**
   * For `short` style: switch to locale date after this many days (default 7).
   * Pass `false` to always use `Nd` (story viewer overlay).
   */
  dateFallbackAfterDays?: number | false;
};

type RelativeUnits = {
  createdAtMs: number;
  diffSeconds: number;
  diffMinutes: number;
  diffHours: number;
  diffDays: number;
};

function parseToMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getRelativeUnits(value: string | Date | null | undefined): RelativeUnits | null {
  const createdAtMs = parseToMs(value);
  if (createdAtMs == null) return null;
  const diffMs = Date.now() - createdAtMs;
  if (diffMs < 0) return null;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  return { createdAtMs, diffSeconds, diffMinutes, diffHours, diffDays };
}

function formatLongCore(units: RelativeUnits): string {
  const { diffSeconds, diffMinutes, diffHours, diffDays } = units;
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

function formatCompactCore(units: RelativeUnits): string {
  const { diffSeconds, diffMinutes, diffHours, diffDays } = units;
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatShortCore(units: RelativeUnits, dateFallbackAfterDays: number | false): string {
  const { diffSeconds, diffMinutes, diffHours, diffDays, createdAtMs } = units;
  if (diffSeconds < 60) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  const useDateFallback = dateFallbackAfterDays !== false;
  const fallbackThreshold = useDateFallback ? dateFallbackAfterDays : Number.POSITIVE_INFINITY;
  if (diffDays < fallbackThreshold) return `${diffDays}d`;
  return new Date(createdAtMs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRelativeTime(
  value: string | Date | null | undefined,
  options: FormatRelativeTimeOptions = {},
): string {
  const {
    style = "long",
    prefix = "",
    empty = "",
    dateFallbackAfterDays = style === "short" ? 7 : false,
  } = options;
  const units = getRelativeUnits(value);
  if (!units) return empty;

  let core: string;
  if (style === "short") {
    core = formatShortCore(units, dateFallbackAfterDays);
  } else if (style === "compact") {
    core = formatCompactCore(units);
  } else {
    core = formatLongCore(units);
  }

  return `${prefix}${core}`;
}

export function formatRelativeLastSeen(value?: string | null): string {
  if (!value) return "last seen recently";
  return formatRelativeTime(value, { style: "long", prefix: "last seen ", empty: "last seen recently" });
}

/** Story discussion timestamps (compact, no "ago"). */
export function formatStoryDiscussionTime(iso: string): string {
  return formatRelativeTime(iso, { style: "short" });
}
