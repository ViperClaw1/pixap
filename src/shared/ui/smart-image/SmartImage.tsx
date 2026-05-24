import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, type ImageErrorEventData, type ImageProps, type ImageSource, type ImageSourceProps } from "expo-image";
import { getSupabaseStorageObjectFallbackUrl } from "@/shared/lib/imageUtils";
import { recordStorageImageRequest } from "@/shared/lib/storageEgressMetrics";

const FALLBACK = require("../../../../assets/web/placeholder.png");
const PREFETCH_CONCURRENCY = 4;
const PREFETCH_HARD_CAP = 8;

export type SmartImageProps = Omit<ImageProps, "source"> & {
  /** Primary image URI (remote, file, or content). */
  uri?: string | null;
  /** Used when primary is empty/invalid, or after primary fails to load. */
  fallbackUri?: string | null;
  /** Bundled asset when URI chain is exhausted (default: app adaptive icon). */
  bundledFallback?: ImageSource;
  /** When true, do not show the bundled placeholder while loading (e.g. small circular avatars). */
  skipBundledPlaceholder?: boolean;
  /** Retry attempts for primary/fallback chain. Default: 1 */
  retryCount?: number;
  /** Optional low-res placeholder hash */
  blurhash?: string;
  /** Optional network priority */
  priority?: ImageSource["priority"];
  /** Fired when every URI in the chain (and retries) failed and no bundled asset is shown. */
  onSourcesExhausted?: () => void;
};

function normalizeUri(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

function isLoadableUri(s: string): boolean {
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
  if (
    lower.startsWith("file://") ||
    lower.startsWith("content://") ||
    lower.startsWith("ph://") ||
    lower.startsWith("assets-library://")
  ) {
    return true;
  }
  return false;
}

/** Ordered, de-duplicated list of URIs to try before bundled fallback. */
function buildUriChain(uri?: string | null, fallbackUri?: string | null): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => {
    const n = normalizeUri(v);
    if (n && isLoadableUri(n) && !out.includes(n)) out.push(n);
  };
  add(uri);
  if (uri) {
    const objectFallback = getSupabaseStorageObjectFallbackUrl(uri);
    add(objectFallback);
  }
  add(fallbackUri);
  return out;
}

/**
 * Remote/local image with one bundled fallback asset.
 * Handles null/undefined/empty/invalid strings; steps through fallbackUri on load error.
 */
export function SmartImage({
  uri,
  fallbackUri,
  bundledFallback,
  onError,
  recyclingKey,
  skipBundledPlaceholder,
  retryCount: retryCountProp,
  blurhash,
  priority,
  onSourcesExhausted,
  ...rest
}: SmartImageProps) {
  const chain = useMemo(() => buildUriChain(uri, fallbackUri), [uri, fallbackUri]);
  const chainKey = chain.join("|");
  const retryCount = Math.max(0, retryCountProp ?? 1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [chainKey]);

  useEffect(() => {
    const primary = chain[0];
    if (primary) recordStorageImageRequest(primary, "display");
  }, [chainKey, chain]);

  useEffect(() => {
    if (chain.length === 0 && skipBundledPlaceholder) {
      onSourcesExhausted?.();
    }
  }, [chain.length, chainKey, onSourcesExhausted, skipBundledPlaceholder]);

  const maxAttempts = chain.length > 0 ? chain.length + retryCount : 0;
  const sourcesExhausted = chain.length > 0 && attempt >= maxAttempts;
  const sourceIndex = Math.min(Math.max(chain.length - 1, 0), attempt);
  /** Без кастомного `cacheKey`: ключ кэша = `uri`, как у `Image.prefetch` — повторный mount попадает в disk/memory. */
  const activeUri =
    !sourcesExhausted && sourceIndex >= 0 && sourceIndex < chain.length
      ? chain[sourceIndex]!
      : null;
  const source = activeUri ? { uri: activeUri, priority, cacheKey: activeUri } : undefined;

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setAttempt((a) => {
        const limit = chain.length + retryCount;
        const next = a < limit ? a + 1 : a;
        if (next >= limit && chain.length > 0) {
          onSourcesExhausted?.();
        }
        return next;
      });
      onError?.(event);
    },
    [chain.length, onError, onSourcesExhausted, retryCount],
  );

  const rk = recyclingKey ?? (chainKey ? `${chainKey}#${attempt}` : "smartimg-fallback");
  const shouldShowBundledPlaceholder = !skipBundledPlaceholder;
  const bundledAsset = bundledFallback ?? FALLBACK;
  const finalSource = source ?? (shouldShowBundledPlaceholder ? bundledAsset : undefined);
  const placeholderSource = blurhash
    ? ({ blurhash } as ImageSourceProps)
    : shouldShowBundledPlaceholder
      ? (bundledAsset as ImageProps["placeholder"])
      : undefined;

  return (
    <Image
      {...rest}
      recyclingKey={rk}
      source={finalSource}
      placeholder={placeholderSource}
      placeholderContentFit={(rest.contentFit ?? "cover") as ImageProps["placeholderContentFit"]}
      onError={handleError}
      cachePolicy="memory-disk"
    />
  );
}

export async function preloadSmartImages(uris: Array<string | null | undefined>): Promise<void> {
  const normalized = Array.from(
    new Set(
      uris
        .map((uri) => normalizeUri(uri))
        .filter((uri): uri is string => Boolean(uri && isLoadableUri(uri))),
    ),
  );
  if (!normalized.length) return;
  const queue = normalized.slice(0, PREFETCH_HARD_CAP);
  for (let i = 0; i < queue.length; i += PREFETCH_CONCURRENCY) {
    const batch = queue.slice(i, i + PREFETCH_CONCURRENCY);
    await Promise.allSettled(
      batch.map((uri) => {
        recordStorageImageRequest(uri, "prefetch");
        return Image.prefetch(uri, "memory-disk");
      }),
    );
  }
}

