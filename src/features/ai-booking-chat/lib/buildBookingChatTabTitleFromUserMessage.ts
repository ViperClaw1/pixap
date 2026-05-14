const STOP_WORDS = new Set([
  "i",
  "want",
  "would",
  "like",
  "need",
  "looking",
  "for",
  "please",
  "give",
  "me",
  "show",
  "find",
  "some",
  "the",
  "a",
  "an",
  "to",
  "with",
  "am",
  "we",
  "can",
  "you",
  "get",
  "help",
  "book",
  "booking",
  "reserve",
]);

function shortenCity(city: string): string {
  const t = city.trim();
  if (!t) return "your city";
  const comma = t.indexOf(",");
  return comma > 0 ? t.slice(0, comma).trim() : t;
}

/**
 * Short tab title from first user line + booking city, e.g. "Lounge vibe places in Tallinn".
 */
export function buildBookingChatTabTitleFromUserMessage(userText: string, city: string): string {
  const raw = userText.trim().replace(/\s+/g, " ");
  const placeCity = shortenCity(city);
  if (!raw) {
    return `Places in ${placeCity}`;
  }

  const beforeComma = raw.split(",")[0]?.trim() ?? raw;
  const words = beforeComma
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  const core = words.slice(0, 4).join(" ");
  if (!core) {
    return `Places in ${placeCity}`;
  }

  const label = core.charAt(0).toUpperCase() + core.slice(1);
  let title = `${label} places in ${placeCity}`;
  if (title.length > 44) {
    title = `${title.slice(0, 41)}…`;
  }
  return title;
}
