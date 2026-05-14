/** HTTP(S) URL token — trailing punctuation excluded from match. */
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export type UrlTextSegment =
  | { kind: "text"; text: string }
  | { kind: "url"; text: string; url: string };

/**
 * Splits plain text into alternating text and http(s) URL segments.
 * Run on each `text` slice after `splitShareEntityContent`.
 */
export function splitTextWithUrls(raw: string): UrlTextSegment[] {
  const content = raw;
  if (!content) return [];
  const segments: UrlTextSegment[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "gi");
  for (;;) {
    const m = re.exec(content);
    if (!m?.[0]) break;
    const start = m.index;
    const rawUrl = m[0];
    const url = trimTrailingPunctuation(rawUrl);
    if (start > last) {
      segments.push({ kind: "text", text: content.slice(last, start) });
    }
    segments.push({ kind: "url", text: url, url });
    last = start + rawUrl.length;
  }
  if (last < content.length) {
    segments.push({ kind: "text", text: content.slice(last) });
  }
  return segments.length ? segments : [{ kind: "text", text: content }];
}

function trimTrailingPunctuation(s: string): string {
  return s.replace(/[),.;:!?]+$/, "");
}

const FIRST_URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

/** First http(s) URL in the string, or null. */
export function findFirstHttpUrl(raw: string): string | null {
  const m = raw.match(FIRST_URL_RE);
  if (!m?.[0]) return null;
  return trimTrailingPunctuation(m[0]);
}
