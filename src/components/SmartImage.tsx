import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, type ImageErrorEventData, type ImageProps } from "expo-image";

const FALLBACK = require("../assets/placeholder-business-card.png");

export type SmartImageProps = Omit<ImageProps, "source"> & {
  /** Primary image URI (remote, file, or content). */
  uri?: string | null;
  /** Used when primary is empty/invalid, or after primary fails to load. */
  fallbackUri?: string | null;
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
  add(fallbackUri);
  return out;
}

/**
 * Remote/local image with one bundled fallback asset.
 * Handles null/undefined/empty/invalid strings; steps through fallbackUri on load error.
 */
export function SmartImage({ uri, fallbackUri, onError, recyclingKey, ...rest }: SmartImageProps) {
  const chain = useMemo(() => buildUriChain(uri, fallbackUri), [uri, fallbackUri]);
  const chainKey = chain.join("|");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [chainKey]);

  const source = attempt < chain.length ? { uri: chain[attempt]! } : FALLBACK;

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setAttempt((a) => (a < chain.length ? a + 1 : a));
      onError?.(event);
    },
    [chain.length, onError],
  );

  const rk = recyclingKey ?? (chainKey ? `${chainKey}#${attempt}` : "smartimg-fallback");

  return (
    <Image
      {...rest}
      recyclingKey={rk}
      source={source}
      onError={handleError}
      cachePolicy="memory-disk"
      placeholder={FALLBACK}
      placeholderContentFit={rest.contentFit ?? "cover"}
    />
  );
}
