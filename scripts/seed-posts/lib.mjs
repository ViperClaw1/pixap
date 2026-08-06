import {
  createRng,
  createSupabaseAdmin,
  log,
  pickFrom,
  pickInt,
  sleep,
  toNodeBuffer,
  withRetry,
} from "../seed-business-cards/lib.mjs";

export {
  createRng,
  createSupabaseAdmin,
  log,
  pickFrom,
  pickInt,
  sleep,
  toNodeBuffer,
  withRetry,
};

export const POSTS_BUCKET = "stories";
export const DEFAULT_COUNT = 10;
export const DEFAULT_IMAGE_MIN = 1;
export const DEFAULT_IMAGE_MAX = 3;
export const MAX_POST_IMAGES = 8;
export const STORAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

function readValue(args, index, flag) {
  const arg = args[index];
  if (arg.startsWith(`${flag}=`)) return { value: arg.slice(flag.length + 1), consumed: 0 };
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return { value, consumed: 1 };
}

function parseInteger(raw, flag, min, max) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${flag} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export function parseCliArgs(argv) {
  const args = argv.slice(2);
  let count = DEFAULT_COUNT;
  let images = null;
  let likes = 0;
  let city = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run" || arg === "--create-users") continue;

    if (arg === "--count" || arg.startsWith("--count=")) {
      const parsed = readValue(args, index, "--count");
      count = parseInteger(parsed.value, "--count", 1, 100);
      index += parsed.consumed;
      continue;
    }

    if (arg === "--images" || arg.startsWith("--images=")) {
      const parsed = readValue(args, index, "--images");
      images = parseInteger(parsed.value, "--images", 1, MAX_POST_IMAGES);
      index += parsed.consumed;
      continue;
    }

    if (arg === "--likes" || arg.startsWith("--likes=")) {
      const parsed = readValue(args, index, "--likes");
      likes = parseInteger(parsed.value, "--likes", 0, 1000);
      index += parsed.consumed;
      continue;
    }

    if (arg === "--city" || arg.startsWith("--city=")) {
      const parsed = readValue(args, index, "--city");
      city = parsed.value.trim();
      if (!city) throw new Error("--city cannot be empty");
      index += parsed.consumed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    count,
    images,
    likes,
    city,
    dryRun: args.includes("--dry-run"),
    createUsers: args.includes("--create-users"),
  };
}

function parseImageValue(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];

  const value = raw.trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.replace(/^"(.*)"$/, "$1"));
  }
  return [value];
}

export function normalizeBusinessCardImages(card) {
  const values = [...parseImageValue(card.images), ...parseImageValue(card.image)];
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => /^https?:\/\//i.test(value)),
    ),
  ];
}

export function shuffled(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
