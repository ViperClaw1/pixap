/**
 * Embedded place link in DM text. Parsed in MessageThreadListItem → opens PlaceDetail with `id`.
 * Format: [[pixap:place:<uuid>|<optional display name>]]
 */
export const PLACE_SHARE_PREFIX = "[[pixap:place:";
export const STORY_SHARE_PREFIX = "[[pixap:story:";
const MARKER_CLOSE = "]]";

const markerPattern = /\[\[pixap:place:([^|\]]+)(?:\|([^\]]*))?\]\]/g;
const entityMarkerPattern = /\[\[pixap:(place|story):([^|\]]+)(?:\|([^\]]*))?\]\]/g;

export function buildSharePlaceMessageBody(userText: string, placeId: string, placeName: string): string {
  const safeName =
    (placeName || "Place")
      .replace(/\|/g, " ")
      .replace(/\]\]/g, "")
      .trim() || "Place";
  const marker = `${PLACE_SHARE_PREFIX}${placeId}|${safeName}${MARKER_CLOSE}`;
  const trimmed = userText.trim();
  return trimmed ? `${trimmed}\n\n${marker}` : marker;
}

export function buildShareStoryMessageBody(userText: string, storyId: string, storyLabel: string): string {
  const safeLabel =
    (storyLabel || "Story")
      .replace(/\|/g, " ")
      .replace(/\]\]/g, "")
      .trim() || "Story";
  const marker = `${STORY_SHARE_PREFIX}${storyId}|${safeLabel}${MARKER_CLOSE}`;
  const trimmed = userText.trim();
  return trimmed ? `${trimmed}\n\n${marker}` : marker;
}

export type PlaceShareSegment =
  | { kind: "text"; text: string }
  | { kind: "place"; id: string; label: string };

export type ShareEntitySegment =
  | { kind: "text"; text: string }
  | { kind: "place"; id: string; label: string }
  | { kind: "story"; id: string; label: string };

export function splitPlaceShareContent(raw: string): PlaceShareSegment[] {
  const content = raw;
  if (!content.includes(PLACE_SHARE_PREFIX)) {
    return [{ kind: "text", text: content }];
  }
  const segments: PlaceShareSegment[] = [];
  let lastEnd = 0;
  const re = new RegExp(markerPattern.source, "g");
  for (;;) {
    const match = re.exec(content);
    if (!match) break;
    const start = match.index ?? 0;
    if (start > lastEnd) {
      segments.push({ kind: "text", text: content.slice(lastEnd, start) });
    }
    const id = match[1]?.trim() ?? "";
    const label = match[2]?.trim() ?? "View place";
    if (id) {
      segments.push({ kind: "place", id, label });
    }
    lastEnd = start + match[0].length;
  }
  if (lastEnd < content.length) {
    segments.push({ kind: "text", text: content.slice(lastEnd) });
  }
  return segments.length ? segments : [{ kind: "text", text: content }];
}

export function splitShareEntityContent(raw: string): ShareEntitySegment[] {
  const content = raw;
  if (!content.includes("[[pixap:")) {
    return [{ kind: "text", text: content }];
  }
  const segments: ShareEntitySegment[] = [];
  let lastEnd = 0;
  const re = new RegExp(entityMarkerPattern.source, "g");
  for (;;) {
    const match = re.exec(content);
    if (!match) break;
    const start = match.index ?? 0;
    if (start > lastEnd) {
      segments.push({ kind: "text", text: content.slice(lastEnd, start) });
    }
    const kindRaw = match[1];
    const id = match[2]?.trim() ?? "";
    const label = match[3]?.trim() || (kindRaw === "story" ? "View story" : "View place");
    if (id && (kindRaw === "place" || kindRaw === "story")) {
      segments.push({ kind: kindRaw, id, label });
    }
    lastEnd = start + match[0].length;
  }
  if (lastEnd < content.length) {
    segments.push({ kind: "text", text: content.slice(lastEnd) });
  }
  return segments.length ? segments : [{ kind: "text", text: content }];
}
