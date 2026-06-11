import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

export const BUSINESS_CARDS_BUCKET = "business-cards";
export const SEED_STORAGE_PREFIX = "seed/pixap-demo";
/** Default venue count when `--count` is omitted. */
export const SEED_COUNT = 10;
export const SEED_COUNT_MIN = 1;
export const SEED_COUNT_MAX = 100;
/** Per-venue image count when `--images` is omitted (random in this range). */
export const SEED_IMAGES_DEFAULT_MIN = 3;
export const SEED_IMAGES_DEFAULT_MAX = 6;
/** Bounds for `--images` / validation. */
export const SEED_IMAGES_MIN = 1;
export const SEED_IMAGES_MAX = 20;
export const RNG_SEED = 20260522;

/** Matches `public.categories` on project pix (ylcyktbppowabnxuwdrr). */
export const CATEGORY_IDS = {
  restaurants: "a1111111-1111-1111-1111-111111111111",
  bars: "48f7ad5a-d765-43e3-9928-cc181660547c",
  beauty: "a2222222-2222-2222-2222-222222222222",
  clubs: "028ae1f2-7f67-45ce-8bea-caa225bf4d5b",
  entertainment: "87ecac2f-4edf-4e20-bba1-d1f034f98da3",
  fitness: "2cecadb0-d31e-4dd5-bcf9-72a047fc5430",
  hotels: "9689cf5e-cf27-4b93-8a24-901d2d1000e4",
};

export const LOCALES = ["ru", "es", "pt", "fr", "de"];

export const STORAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Deep clone venue template so nested `name` / `description` are not shared across slots. */
export function cloneVenueDefinition(venue) {
  return structuredClone(venue);
}

/** Node `crypto` and Supabase Storage expect Buffer, not `fetch()`'s ArrayBuffer. */
export function toNodeBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof ArrayBuffer) return Buffer.from(bytes);
  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  throw new Error(`Expected binary image data, got ${typeof bytes}`);
}

/** Default cap for a single Google Places photo download in the seed script. */
export const DEFAULT_GOOGLE_PHOTO_MAX_KB = 150;

/** Mulberry32 — deterministic PRNG */
export function createRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickInt(rng, min, maxInclusive) {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function pickFrom(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Human-readable `business_cards.location` (text column on prod).
 * Matches existing rows: shortened address + approximate coordinates.
 */
export function formatBusinessCardLocation(address, latitude, longitude) {
  const addr = address?.trim() ?? "";
  if (!addr) return "";

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return addr;

  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  const label = parts.length >= 3 ? parts.slice(0, -1).join(", ") : addr;
  const latStr = Number(lat.toFixed(4));
  const lngStr = Number(lng.toFixed(4));
  return `${label} (approx. ${latStr}, ${lngStr})`;
}

/** First segment of a formatted address (street / POI line). */
export function shortAddressHint(address) {
  const first = address?.split(",")[0]?.trim() ?? "";
  if (!first) return "";
  return first.length > 48 ? `${first.slice(0, 45)}…` : first;
}

/** Keeps batch `name` unique when Google returns the same chain label twice. */
export function disambiguateListingName(name, address, usedNames) {
  const base = name.trim();
  if (!usedNames.has(base)) return base;

  const hint = shortAddressHint(address);
  let candidate = hint ? `${base} · ${hint}` : `${base} #${usedNames.size + 1}`;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = hint ? `${base} · ${hint} (${suffix})` : `${base} #${usedNames.size + suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * E.164-style string for DB: keep leading `+`, drop spaces, parentheses, dashes.
 * @returns {string | null}
 */
export function normalizeSeedPhone(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d{7,16}$/.test(cleaned)) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadGoogleMapsApiKey() {
  const fromFile = {
    ...parseEnvFile(resolve(REPO_ROOT, ".env")),
    ...parseEnvFile(resolve(REPO_ROOT, ".env.local")),
  };
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ??
    process.env.GOOGLE_MAPS_WEB_API_KEY ??
    fromFile.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ??
    fromFile.GOOGLE_MAPS_WEB_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    fromFile.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    fromFile.GOOGLE_MAPS_API_KEY ??
    null
  );
}

/**
 * @param {string[]} argv process.argv
 */
function parseGooglePhotoMaxKbArg(raw) {
  if (raw == null || raw === "") return DEFAULT_GOOGLE_PHOTO_MAX_KB;
  const kb = Number(raw);
  if (!Number.isFinite(kb) || kb < 0) {
    throw new Error(`Invalid --google-photo-max-kb value: ${raw} (use 0 for no limit, or a positive number)`);
  }
  return Math.floor(kb);
}

function parseCountArg(raw) {
  if (raw == null || raw === "") return SEED_COUNT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < SEED_COUNT_MIN || n > SEED_COUNT_MAX) {
    throw new Error(
      `Invalid --count value: ${raw} (use integer ${SEED_COUNT_MIN}–${SEED_COUNT_MAX}, default ${SEED_COUNT})`,
    );
  }
  return n;
}

/**
 * @param {string} raw
 * @returns {number | "all"}
 */
export function parseImagesArg(raw) {
  const trimmed = String(raw ?? "").trim().toLowerCase();
  if (!trimmed) {
    throw new Error(`Invalid --images value: empty (use integer ${SEED_IMAGES_MIN}–${SEED_IMAGES_MAX} or "all")`);
  }
  if (trimmed === "all" || trimmed === "max") return "all";
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < SEED_IMAGES_MIN || n > SEED_IMAGES_MAX) {
    throw new Error(
      `Invalid --images value: ${raw} (use integer ${SEED_IMAGES_MIN}–${SEED_IMAGES_MAX}, or "all" for every Google photo)`,
    );
  }
  return n;
}

const TAGS_MIN = 3;
const TAGS_MAX = 12;

/**
 * @param {string} raw Comma-separated slugs or JSON string array
 * @returns {string[]}
 */
export function parseTagsArg(raw) {
  if (raw == null || String(raw).trim() === "") return null;

  const trimmed = String(raw).trim();
  let parts;

  if (trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid --tags JSON: ${trimmed.slice(0, 80)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("--tags JSON must be an array of strings");
    }
    parts = parsed;
  } else {
    parts = trimmed.split(",");
  }

  const tags = parts
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0);

  if (tags.length < TAGS_MIN) {
    throw new Error(`--tags requires at least ${TAGS_MIN} non-empty tags (got ${tags.length})`);
  }
  if (tags.length > TAGS_MAX) {
    throw new Error(`--tags allows at most ${TAGS_MAX} tags (got ${tags.length})`);
  }

  return [...new Set(tags)];
}

const NAMES_MIN = 1;
const NAMES_MAX = 50;

/**
 * @param {string} raw Comma-separated venue names or JSON string array
 * @returns {string[]}
 */
export function parseNamesArg(raw) {
  if (raw == null || String(raw).trim() === "") return null;

  const trimmed = String(raw).trim();
  let parts;

  if (trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid --names JSON: ${trimmed.slice(0, 80)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("--names JSON must be an array of strings");
    }
    parts = parsed;
  } else {
    parts = trimmed.split(",");
  }

  const names = parts.map((t) => String(t).trim()).filter((t) => t.length > 0);

  if (names.length < NAMES_MIN) {
    throw new Error(`--names requires at least ${NAMES_MIN} non-empty venue name`);
  }
  if (names.length > NAMES_MAX) {
    throw new Error(`--names allows at most ${NAMES_MAX} venue names (got ${names.length})`);
  }

  return names;
}

const LINKS_MIN = 1;
const LINKS_MAX = 50;

function isGoogleMapsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl" || host === "goo.gl" || host.endsWith(".goo.gl")) return true;
    return host.includes("google.") && (url.pathname.includes("/maps") || url.searchParams.has("cid"));
  } catch {
    return false;
  }
}

/**
 * @param {string} raw Comma-separated Maps URLs or JSON string array
 * @returns {string[]}
 */
export function parseLinksArg(raw) {
  if (raw == null || String(raw).trim() === "") return null;

  const trimmed = String(raw).trim();
  let parts;

  if (trimmed.startsWith("[")) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error(`Invalid --link JSON: ${trimmed.slice(0, 80)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error("--link JSON must be an array of strings");
    }
    parts = parsed;
  } else {
    parts = [trimmed];
  }

  const links = parts.map((t) => String(t).trim()).filter((t) => t.length > 0);

  if (links.length < LINKS_MIN) {
    throw new Error(`--link requires at least ${LINKS_MIN} Google Maps URL`);
  }
  if (links.length > LINKS_MAX) {
    throw new Error(`--link allows at most ${LINKS_MAX} URLs (got ${links.length})`);
  }

  for (const link of links) {
    if (!isGoogleMapsUrl(link)) {
      throw new Error(`--link value is not a Google Maps URL: ${link.slice(0, 120)}`);
    }
  }

  return links;
}

const LISTING_TYPES = new Set(["featured", "recommended"]);

/**
 * @param {string} raw
 * @returns {"featured" | "recommended"}
 */
export function parseListingTypeArg(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!LISTING_TYPES.has(value)) {
    throw new Error(`Invalid --listing-type "${raw}". Valid values: featured, recommended`);
  }
  return value;
}

const CLI_BOOLEAN_FLAGS = new Set([
  "--dry-run",
  "--skip-images",
  "--no-google",
  "--allow-duplicate",
]);

/** Windows / copy-paste often turns `--flag` into `-—flag` (hyphen + em dash). */
const UNICODE_DASH_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/** @param {string} arg */
export function normalizeCliArg(arg) {
  if (typeof arg !== "string") return arg;
  return arg.replace(UNICODE_DASH_RE, "-");
}

function requireCliValue(flag, args, index) {
  const next = args[index + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`${flag} requires a value (e.g. ${flag} Istanbul)`);
  }
  return next;
}

export function parseCliArgs(argv) {
  const args = argv.slice(2).map(normalizeCliArg);
  let city = null;
  let cityParsedAsShorthand = false;
  let type = null;
  let googlePhotoMaxKb = DEFAULT_GOOGLE_PHOTO_MAX_KB;
  let count = SEED_COUNT;
  let tags = null;
  let names = null;
  let links = null;
  let listingType = null;
  let images = null;
  const handled = new Set();

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (CLI_BOOLEAN_FLAGS.has(a)) {
      handled.add(i);
      continue;
    }
    if (a === "--city" || a.startsWith("--city=")) {
      city = a.startsWith("--city=") ? a.slice("--city=".length) : requireCliValue("--city", args, i);
      handled.add(i);
      if (!a.startsWith("--city=")) handled.add(i + 1);
      if (!a.startsWith("--city=")) i += 1;
      continue;
    }
    if (a === "--type" || a.startsWith("--type=")) {
      type = a.startsWith("--type=") ? a.slice("--type=".length) : requireCliValue("--type", args, i);
      handled.add(i);
      if (!a.startsWith("--type=")) handled.add(i + 1);
      if (!a.startsWith("--type=")) i += 1;
      continue;
    }
    if (a === "--google-photo-max-kb" || a.startsWith("--google-photo-max-kb=")) {
      const raw = a.startsWith("--google-photo-max-kb=")
        ? a.slice("--google-photo-max-kb=".length)
        : requireCliValue("--google-photo-max-kb", args, i);
      googlePhotoMaxKb = parseGooglePhotoMaxKbArg(raw);
      handled.add(i);
      if (!a.startsWith("--google-photo-max-kb=")) handled.add(i + 1);
      if (!a.startsWith("--google-photo-max-kb=")) i += 1;
      continue;
    }
    if (a === "--count" || a.startsWith("--count=")) {
      const raw = a.startsWith("--count=") ? a.slice("--count=".length) : requireCliValue("--count", args, i);
      count = parseCountArg(raw);
      handled.add(i);
      if (!a.startsWith("--count=")) handled.add(i + 1);
      if (!a.startsWith("--count=")) i += 1;
      continue;
    }
    if (a === "--images" || a.startsWith("--images=")) {
      const raw = a.startsWith("--images=") ? a.slice("--images=".length) : requireCliValue("--images", args, i);
      images = parseImagesArg(raw);
      handled.add(i);
      if (!a.startsWith("--images=")) handled.add(i + 1);
      if (!a.startsWith("--images=")) i += 1;
      continue;
    }
    if (a === "--tags" || a.startsWith("--tags=")) {
      const raw = a.startsWith("--tags=") ? a.slice("--tags=".length) : requireCliValue("--tags", args, i);
      tags = parseTagsArg(raw);
      handled.add(i);
      if (!a.startsWith("--tags=")) handled.add(i + 1);
      if (!a.startsWith("--tags=")) i += 1;
      continue;
    }
    if (a === "--names" || a.startsWith("--names=")) {
      const raw = a.startsWith("--names=") ? a.slice("--names=".length) : requireCliValue("--names", args, i);
      names = parseNamesArg(raw);
      handled.add(i);
      if (!a.startsWith("--names=")) handled.add(i + 1);
      if (!a.startsWith("--names=")) i += 1;
      continue;
    }
    if (a === "--link" || a.startsWith("--link=")) {
      const raw = a.startsWith("--link=") ? a.slice("--link=".length) : requireCliValue("--link", args, i);
      links = parseLinksArg(raw);
      handled.add(i);
      if (!a.startsWith("--link=")) handled.add(i + 1);
      if (!a.startsWith("--link=")) i += 1;
      continue;
    }
    if (a === "--listing-type" || a.startsWith("--listing-type=")) {
      const raw = a.startsWith("--listing-type=")
        ? a.slice("--listing-type=".length)
        : requireCliValue("--listing-type", args, i);
      listingType = parseListingTypeArg(raw);
      handled.add(i);
      if (!a.startsWith("--listing-type=")) handled.add(i + 1);
      if (!a.startsWith("--listing-type=")) i += 1;
      continue;
    }
  }

  for (let i = 0; i < args.length; i += 1) {
    if (handled.has(i)) continue;
    const a = args[i];
    if (!a.startsWith("--")) {
      const flagHint = /tags|listing|link|names/i.test(a)
        ? " Use ASCII double hyphen for flags (e.g. --tags=a,b,c)."
        : "";
      throw new Error(
        `Unexpected argument "${a}". To seed one city use: --city "${a}"${flagHint}`,
      );
    }
    const shorthand = a.slice(2).trim();
    if (!shorthand) throw new Error(`Invalid flag "${a}"`);
    if (city) {
      throw new Error(`Unknown flag "${a}" (city is already "${city}")`);
    }
    city = shorthand;
    cityParsedAsShorthand = true;
    handled.add(i);
  }

  if (names?.length && links?.length) {
    throw new Error("Use either --names or --link, not both");
  }

  if (links?.length) {
    count = links.length;
  } else if (names?.length) {
    count = names.length;
  }

  return {
    dryRun: args.includes("--dry-run"),
    skipImages: args.includes("--skip-images"),
    noGoogle: args.includes("--no-google"),
    /** With `--link`, skip address dedupe and insert even if the POI is already in business_cards. */
    allowDuplicate: args.includes("--allow-duplicate"),
    city: city?.trim() || null,
    cityParsedAsShorthand,
    type: type?.trim() || null,
    count,
    /** When set, Google Places Text Search targets these venue names (requires `--city`). */
    names,
    /** When set, venue data is loaded from these Google Maps URLs (`--city` optional). */
    links,
    /** When set, overrides `business_cards.type` for every row (`featured` | `recommended`). */
    listingType,
    /** Fixed image count per venue, or `"all"` to use every Google Places photo (up to SEED_IMAGES_MAX). */
    images,
    /** When set, overrides `tags` / `tags_*` on every inserted row (lowercased slugs). */
    tags,
    /** `0` = no byte cap; otherwise max downloaded size per Google Places photo. */
    googlePhotoMaxKb,
    googlePhotoMaxBytes: googlePhotoMaxKb > 0 ? googlePhotoMaxKb * 1024 : null,
  };
}

export function loadEnv() {
  const fromFile = {
    ...parseEnvFile(resolve(REPO_ROOT, ".env")),
    ...parseEnvFile(resolve(REPO_ROOT, ".env.local")),
  };
  const url =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    fromFile.SUPABASE_URL ??
    fromFile.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. " +
        "Set them in .env or the shell environment. Never commit the service role key.",
    );
  }
  return { url, serviceKey };
}

export function createSupabaseAdmin() {
  const { url, serviceKey } = loadEnv();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function log(step, message) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${step}] ${message}`);
}

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Transient network / rate-limit errors worth retrying in seed scripts. */
export function isRetryableNetworkError(err) {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket hang up")) {
    return true;
  }
  if (msg.includes("aborterror") || msg.includes("aborted") || msg.includes("timeout")) return true;
  const code = err?.code ?? err?.cause?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return true;
  }
  const status = err?.status ?? err?.cause?.status;
  if (status === 429 || status === 502 || status === 503 || status === 504) return true;
  return false;
}

/**
 * @template T
 * @param {string} label
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, baseDelayMs?: number, maxDelayMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(label, fn, { attempts = 4, baseDelayMs = 700, maxDelayMs = 12_000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableNetworkError(err);
      if (!retryable || i >= attempts - 1) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
      log("retry", `${label}: ${err.message} — pause ${delay}ms (attempt ${i + 2}/${attempts})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Curated Unsplash slugs (no placeholder hashes). @see https://unsplash.com/license */
const VERIFIED_UNSPLASH = [
  "1517248135467-4c7edcad34c4",
  "1555396273-367ea4eb4db5",
  "1414235077428-338989a2e8c0",
  "1552566626-52f8b8288cbf",
  "1592869605093-5d48f8c37ed0",
  "1559339352-11d035aa292e",
  "1495474473867-a810b4a2d42f",
  "1509042239860-f550ce710b93",
  "1442512595331-e89e6ba93f49",
  "1521017430919-bc82fcd79c2d",
  "1572116469694-31fa883da44b",
  "1470337458703-46ad1756a187",
  "1514362545529-6bfadff23824",
  "1551024506-0bccd628d599",
  "1544148101-4933ce891da2",
  "1566073771259-6a8506099945",
  "1582719508461-905c593771e7",
  "1631049307264-e5b675e42e08",
  "1520250497594-b71fa999bbee",
  "1534438327276-14e5300c6a48",
  "1517836357463-d25dfeac3438",
  "1574680096145-84fd6288aea1",
  "1540497077202-f55e30efbc23",
  "1560066984-138dadb4c035",
  "1487412720507-e7ab37618c88",
  "1522337360788-8ba4bb88f0b4",
  "1497366216548-37526070297c",
  "1497366754035-c0e72dceb45f",
  "1524758646861-7b0f0111f6467",
  "1600880292203-7bfb16d271c5",
  "1571266028245-4c730f1e0ab7",
  "1470229725623-785594424f43",
  "1516450366433-263cbaffa788",
  "1604881991727-f847eeadc5e1",
  "1551218808-94e220a78169",
];

function poolSlice(start, count = 8) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(VERIFIED_UNSPLASH[(start + i) % VERIFIED_UNSPLASH.length]);
  }
  return out;
}

export const PHOTO_POOLS = {
  restaurant: poolSlice(0),
  cafe: poolSlice(4),
  bar: poolSlice(9),
  hotel: poolSlice(14),
  gym: poolSlice(18),
  beauty: poolSlice(22),
  coworking: poolSlice(25),
  club: poolSlice(29),
  hookah: poolSlice(11),
};

/** Lorem Picsum numeric IDs that resolve (avoid 1000+ — often 404). */
export const PICSUM_IDS = [
  237, 292, 326, 431, 459, 488, 514, 548, 564, 582, 622, 659, 688, 718, 742, 767, 788, 801, 824, 849,
  866, 884,
];

export function unsplashDownloadUrl(photoId, width = 1400) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

export function picsumSeedDownloadUrl(seed, width = 1400, height = 933) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

export function picsumIdDownloadUrl(picsumId, width = 1400, height = 933) {
  return `https://picsum.photos/id/${picsumId}/${width}/${height}`;
}
