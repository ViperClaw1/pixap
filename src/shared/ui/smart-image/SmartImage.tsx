import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, type ImageErrorEventData, type ImageProps, type ImageSource, type ImageSourceProps } from "expo-image";

const FALLBACK = require("../../../../assets/android-icon-background.png");

export type SmartImageProps = Omit<ImageProps, "source"> & {
  /** Primary image URI (remote, file, or content). */
  uri?: string | null;
  /** Used when primary is empty/invalid, or after primary fails to load. */
  fallbackUri?: string | null;
  /** When true, do not show the bundled placeholder while loading (e.g. small circular avatars). */
  skipBundledPlaceholder?: boolean;
  /** Retry attempts for primary/fallback chain. Default: 1 */
  retryCount?: number;
  /** Optional low-res placeholder hash */
  blurhash?: string;
  /** Optional network priority */
  priority?: ImageSource["priority"];
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

function buildStableCacheKey(uri: string): string {
  try {
    const url = new URL(uri);
    const host = url.hostname.toLowerCase();
    if (!host.includes("supabase.co") && !host.includes("unsplash.com")) {
      return uri;
    }
    const keepParams = ["width", "height", "quality", "format", "q", "w", "h", "auto"];
    const normalizedParams = new URLSearchParams();
    for (const key of keepParams) {
      const value = url.searchParams.get(key);
      if (value) normalizedParams.set(key, value);
    }
    const query = normalizedParams.toString();
    return query ? `${url.origin}${url.pathname}?${query}` : `${url.origin}${url.pathname}`;
  } catch {
    return uri;
  }
}

/** Ordered, de-duplicated list of URIs to try before bundled fallback. */
function buildUriChain(uri?: string | null, fallbackUri?: string | null): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => {
    const n = normalizeUri(v);
    if (n && isLoadableUri(n) && !out.includes(n)) out.push(n);
  };
  add(uri);
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
  onError,
  recyclingKey,
  skipBundledPlaceholder,
  retryCount: retryCountProp,
  blurhash,
  priority,
  ...rest
}: SmartImageProps) {
  const chain = useMemo(() => buildUriChain(uri, fallbackUri), [uri, fallbackUri]);
  const chainKey = chain.join("|");
  const retryCount = Math.max(0, retryCountProp ?? 1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [chainKey]);

  const sourceIndex = Math.min(chain.length - 1, attempt);
  const source =
    sourceIndex >= 0 && sourceIndex < chain.length
      ? { uri: chain[sourceIndex]!, priority, cacheKey: buildStableCacheKey(chain[sourceIndex]!) }
      : undefined;

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setAttempt((a) => (a < chain.length + retryCount ? a + 1 : a));
      onError?.(event);
    },
    [chain.length, onError, retryCount],
  );

  const rk = recyclingKey ?? (chainKey ? `${chainKey}#${attempt}` : "smartimg-fallback");
  const shouldShowBundledPlaceholder = !skipBundledPlaceholder;
  const finalSource = source ?? (shouldShowBundledPlaceholder ? FALLBACK : undefined);
  const placeholderSource = blurhash
    ? ({ blurhash } as ImageSourceProps)
    : shouldShowBundledPlaceholder
      ? (FALLBACK as ImageProps["placeholder"])
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
  await Promise.allSettled(normalized.map((uri) => Image.prefetch(uri, "memory-disk")));
}

