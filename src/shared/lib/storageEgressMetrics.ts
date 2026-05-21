import { devInfo, devWarn } from "@/shared/lib/devLog";
import { isSupabaseImageTransformEnabled } from "@/shared/lib/imageUtils";

const ENABLED = __DEV__;
const SUMMARY_EVERY_N_REQUESTS = 80;
const MAX_UNIQUE_URLS = 500;

export type StorageRequestSource = "display" | "prefetch";

export type StorageUrlKind = "render" | "object" | "other";

export type StorageEgressMetricsSnapshot = {
  sessionStartedAt: string;
  transformFlagEnabled: boolean;
  totalRequests: number;
  displayRequests: number;
  prefetchRequests: number;
  renderRequests: number;
  objectRequests: number;
  otherRequests: number;
  uniqueUrlCount: number;
  renderSharePercent: number;
  byBucket: Record<string, { render: number; object: number; other: number }>;
};

type BucketCounters = { render: number; object: number; other: number };

let sessionStartedAt = new Date().toISOString();
let totalRequests = 0;
let displayRequests = 0;
let prefetchRequests = 0;
let renderRequests = 0;
let objectRequests = 0;
let otherRequests = 0;
const uniqueUrls = new Set<string>();
const byBucket: Record<string, BucketCounters> = {};

function emptyBucket(): BucketCounters {
  return { render: 0, object: 0, other: 0 };
}

/** Parse Supabase Storage public / render URLs. */
export function classifySupabaseStorageUrl(uri: string): {
  isSupabase: boolean;
  kind: StorageUrlKind;
  bucket: string | null;
} {
  const lower = uri.trim().toLowerCase();
  if (!lower.includes("supabase.co/storage/v1/")) {
    return { isSupabase: false, kind: "other", bucket: null };
  }

  const renderMatch = /\/storage\/v1\/render\/image\/public\/([^/]+)\//i.exec(uri);
  if (renderMatch?.[1]) {
    return { isSupabase: true, kind: "render", bucket: renderMatch[1] };
  }

  const objectMatch = /\/storage\/v1\/object\/public\/([^/]+)\//i.exec(uri);
  if (objectMatch?.[1]) {
    return { isSupabase: true, kind: "object", bucket: objectMatch[1] };
  }

  return { isSupabase: true, kind: "other", bucket: null };
}

function bumpBucket(bucket: string | null, kind: StorageUrlKind) {
  const key = bucket ?? "_unknown";
  if (!byBucket[key]) byBucket[key] = emptyBucket();
  byBucket[key][kind] += 1;
}

/** Dev-only: count Storage CDN requests (display + prefetch) for weekly egress tuning. */
export function recordStorageImageRequest(uri: string | null | undefined, source: StorageRequestSource) {
  if (!ENABLED || !uri?.trim()) return;

  const classified = classifySupabaseStorageUrl(uri);
  if (!classified.isSupabase) return;

  totalRequests += 1;
  if (source === "display") displayRequests += 1;
  else prefetchRequests += 1;

  if (classified.kind === "render") renderRequests += 1;
  else if (classified.kind === "object") objectRequests += 1;
  else otherRequests += 1;

  bumpBucket(classified.bucket, classified.kind);

  if (uniqueUrls.size < MAX_UNIQUE_URLS) {
    uniqueUrls.add(uri.split("#")[0]?.split("?")[0] ?? uri);
  }

  if (totalRequests % SUMMARY_EVERY_N_REQUESTS === 0) {
    logStorageEgressMetricsSummary();
  }
}

export function getStorageEgressMetricsSnapshot(): StorageEgressMetricsSnapshot {
  const denom = totalRequests > 0 ? totalRequests : 1;
  return {
    sessionStartedAt,
    transformFlagEnabled: isSupabaseImageTransformEnabled(),
    totalRequests,
    displayRequests,
    prefetchRequests,
    renderRequests,
    objectRequests,
    otherRequests,
    uniqueUrlCount: uniqueUrls.size,
    renderSharePercent: Math.round((renderRequests / denom) * 1000) / 10,
    byBucket: { ...byBucket },
  };
}

export function resetStorageEgressMetrics() {
  sessionStartedAt = new Date().toISOString();
  totalRequests = 0;
  displayRequests = 0;
  prefetchRequests = 0;
  renderRequests = 0;
  objectRequests = 0;
  otherRequests = 0;
  uniqueUrls.clear();
  for (const key of Object.keys(byBucket)) delete byBucket[key];
}

/** Dev-only: log JSON snapshot for copy into docs/EGRESS_METRICS weekly table. */
export function logStorageEgressMetricsSummary() {
  if (!ENABLED) return;
  const snap = getStorageEgressMetricsSnapshot();
  devInfo("[storage-egress] snapshot", JSON.stringify(snap, null, 2));
  if (snap.totalRequests > 0 && snap.renderSharePercent < 50 && snap.transformFlagEnabled) {
    devWarn(
      "[storage-egress] render share < 50% with transform flag on — check EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM bundle or fallback to /object/public/",
    );
  }
  if (snap.totalRequests > 0 && !snap.transformFlagEnabled) {
    devInfo("[storage-egress] transform flag off — URLs likely full-size /object/public/");
  }
}
