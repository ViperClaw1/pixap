import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image, type ImageErrorEventData, type ImageProps, type ImageSource } from "expo-image";
import { getSupabaseStorageObjectFallbackUrl } from "@/shared/lib/imageUtils";
import { recordStorageImageRequest } from "@/shared/lib/storageEgressMetrics";
import { ShimmerProvider, ShimmerSurface } from "@/shared/ui/shimmer";

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
  /** When true, show ActivityIndicator instead of the bundled placeholder while the remote image loads. */
  showLoadingSpinner?: boolean;
  /** When true, show ShimmerSurface overlay while the remote image loads. */
  showShimmerWhileLoading?: boolean;
  loadingSpinnerColor?: string;
  /** Fired when remote loading state changes (only when `showLoadingSpinner` is true). */
  onLoadingChange?: (loading: boolean) => void;
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

function placeholderLayoutFromStyle(style?: StyleProp<ImageStyle>): { width: number; height: number } {
  const flat = StyleSheet.flatten(style);
  const width = typeof flat?.width === "number" ? flat.width : 32;
  const height = typeof flat?.height === "number" ? flat.height : 32;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function hasExplicitLayout(style?: StyleProp<ImageStyle>): boolean {
  const flat = StyleSheet.flatten(style);
  return typeof flat?.width === "number" && typeof flat?.height === "number";
}

function resolveShimmerLayout(
  style: StyleProp<ImageStyle> | undefined,
  hostLayout: { width: number; height: number },
): { width: number; height: number } {
  if (hasExplicitLayout(style)) {
    return placeholderLayoutFromStyle(style);
  }
  if (hostLayout.width > 0 && hostLayout.height > 0) {
    return {
      width: Math.round(hostLayout.width),
      height: Math.round(hostLayout.height),
    };
  }
  return { width: 0, height: 0 };
}

function clipRoundedHostStyle(style?: StyleProp<ImageStyle>): ViewStyle | undefined {
  const flat = StyleSheet.flatten(style);
  if (!flat) return undefined;
  const hasRadius =
    flat.borderRadius != null ||
    flat.borderTopLeftRadius != null ||
    flat.borderTopRightRadius != null ||
    flat.borderBottomLeftRadius != null ||
    flat.borderBottomRightRadius != null;
  return hasRadius ? { overflow: "hidden" } : undefined;
}

/**
 * Remote/local image with one bundled fallback asset.
 * Handles null/undefined/empty/invalid strings; steps through fallbackUri on load error.
 */
function SmartImageInner({
  uri,
  fallbackUri,
  bundledFallback,
  onError,
  onLoad,
  onLoadStart,
  recyclingKey,
  skipBundledPlaceholder,
  showLoadingSpinner = false,
  showShimmerWhileLoading = false,
  loadingSpinnerColor,
  onLoadingChange,
  retryCount: retryCountProp,
  blurhash,
  priority,
  onSourcesExhausted,
  transition: transitionProp,
  style,
  ...rest
}: SmartImageProps) {
  const trimmedBlurhash = blurhash?.trim() || undefined;
  const hasBlurhashPlaceholder = Boolean(trimmedBlurhash);
  const trackRemoteLoading = showLoadingSpinner || showShimmerWhileLoading;
  const placeholderLayout = useMemo(() => placeholderLayoutFromStyle(style), [style]);
  const transition =
    transitionProp ??
    (skipBundledPlaceholder || trackRemoteLoading || hasBlurhashPlaceholder ? 0 : 150);
  const chain = useMemo(() => buildUriChain(uri, fallbackUri), [uri, fallbackUri]);
  const chainKey = chain.join("|");
  const retryCount = Math.max(0, retryCountProp ?? 1);
  const [attempt, setAttempt] = useState(0);
  const [hostLayout, setHostLayout] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(() => trackRemoteLoading && chain.length > 0);
  const shimmerLayout = useMemo(
    () => resolveShimmerLayout(style, hostLayout),
    [hostLayout, style],
  );

  const setLoadingState = useCallback(
    (next: boolean) => {
      setLoading(next);
      onLoadingChange?.(next);
    },
    [onLoadingChange],
  );

  useEffect(() => {
    setAttempt(0);
  }, [chainKey]);

  useEffect(() => {
    const primary = chain[0];
    if (primary) recordStorageImageRequest(primary, "display");
  }, [chainKey, chain]);

  const maxAttempts = chain.length > 0 ? chain.length + retryCount : 0;
  const sourcesExhausted = chain.length > 0 && attempt >= maxAttempts;

  useEffect(() => {
    if (skipBundledPlaceholder && (chain.length === 0 || sourcesExhausted)) {
      onSourcesExhausted?.();
    }
  }, [chain.length, chainKey, onSourcesExhausted, skipBundledPlaceholder, sourcesExhausted]);

  const sourceIndex = Math.min(Math.max(chain.length - 1, 0), attempt);
  /** Keep ImageSource stable across parent re-renders so cached images do not flash placeholders. */
  const activeUri =
    !sourcesExhausted && sourceIndex >= 0 && sourceIndex < chain.length
      ? chain[sourceIndex]!
      : null;
  const source = useMemo(
    () => (activeUri ? { uri: activeUri, priority, cacheKey: activeUri } : undefined),
    [activeUri, priority],
  );

  useEffect(() => {
    if (!trackRemoteLoading) return;
    if (sourcesExhausted || !activeUri) {
      setLoadingState(false);
      return;
    }
    setLoadingState(true);
  }, [activeUri, chainKey, trackRemoteLoading, sourcesExhausted, setLoadingState]);

  const handleError = useCallback(
    (event: ImageErrorEventData) => {
      setAttempt((a) => {
        const limit = chain.length + retryCount;
        return a < limit ? a + 1 : a;
      });
      onError?.(event);
    },
    [chain.length, onError, retryCount],
  );

  const handleLoadStart = useCallback(
    (event: Parameters<NonNullable<ImageProps["onLoadStart"]>>[0]) => {
      if (trackRemoteLoading && activeUri) {
        setLoadingState(true);
      }
      onLoadStart?.(event);
    },
    [activeUri, onLoadStart, setLoadingState, trackRemoteLoading],
  );

  const handleLoad = useCallback(
    (event: Parameters<NonNullable<ImageProps["onLoad"]>>[0]) => {
      if (trackRemoteLoading) {
        setLoadingState(false);
      }
      onLoad?.(event);
    },
    [onLoad, setLoadingState, trackRemoteLoading],
  );

  const handleHostLayout = useCallback(
    (width: number, height: number) => {
      setHostLayout((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    },
    [],
  );

  const rk = recyclingKey ?? (chainKey ? `${chainKey}#${attempt}` : "smartimg-fallback");
  const effectiveSkipBundledPlaceholder =
    skipBundledPlaceholder || trackRemoteLoading || hasBlurhashPlaceholder;

  const shimmerBorderRadius =
    typeof StyleSheet.flatten(style)?.borderRadius === "number"
      ? (StyleSheet.flatten(style)!.borderRadius as number)
      : 0;
  const shimmerOverlay =
    showShimmerWhileLoading && loading && activeUri && shimmerLayout.width > 0 && shimmerLayout.height > 0 ? (
      <ShimmerProvider active>
        <ShimmerSurface
          width={shimmerLayout.width}
          height={shimmerLayout.height}
          borderRadius={shimmerBorderRadius}
          style={styles.shimmerOverlay}
        />
      </ShimmerProvider>
    ) : null;
  const shouldShowBundledPlaceholder = !effectiveSkipBundledPlaceholder;
  const bundledAsset = bundledFallback ?? (hasBlurhashPlaceholder ? undefined : FALLBACK);
  const finalSource =
    source ?? (shouldShowBundledPlaceholder && bundledAsset != null ? bundledAsset : undefined);
  const placeholderSource = hasBlurhashPlaceholder
    ? ({
        blurhash: trimmedBlurhash,
        width: placeholderLayout.width,
        height: placeholderLayout.height,
      } satisfies ImageSource)
    : shouldShowBundledPlaceholder && bundledAsset != null
      ? (bundledAsset as ImageProps["placeholder"])
      : undefined;

  const blurhashSource = hasBlurhashPlaceholder
    ? ({
        blurhash: trimmedBlurhash,
        width: placeholderLayout.width,
        height: placeholderLayout.height,
      } satisfies ImageSource)
    : undefined;

  const remoteImageProps = {
    ...rest,
    recyclingKey: rk,
    source: finalSource,
    placeholder: hasBlurhashPlaceholder ? undefined : placeholderSource,
    placeholderContentFit: (rest.contentFit ?? "cover") as ImageProps["placeholderContentFit"],
    onError: handleError,
    onLoadStart: handleLoadStart,
    onLoad: handleLoad,
    cachePolicy: "memory-disk" as const,
    transition,
  };

  if (hasBlurhashPlaceholder) {
    const hostStyle = [
      trackRemoteLoading ? style : (style as StyleProp<ViewStyle>),
      clipRoundedHostStyle(style),
    ];

    return (
      <View
        style={hostStyle}
        onLayout={
          trackRemoteLoading
            ? (event) => {
                const { width, height } = event.nativeEvent.layout;
                handleHostLayout(width, height);
              }
            : undefined
        }
      >
        <Image
          source={blurhashSource}
          style={StyleSheet.absoluteFillObject}
          contentFit={rest.contentFit ?? "cover"}
          cachePolicy="memory-disk"
          transition={0}
        />
        {finalSource ? (
          <Image {...remoteImageProps} style={StyleSheet.absoluteFillObject} />
        ) : null}
        {shimmerOverlay}
        {showLoadingSpinner && loading && activeUri ? (
          <View style={styles.spinnerHost}>
            <ActivityIndicator size="large" color={loadingSpinnerColor} />
          </View>
        ) : null}
      </View>
    );
  }

  const imageStyle = trackRemoteLoading ? StyleSheet.absoluteFillObject : style;

  const image = (
    <Image
      {...remoteImageProps}
      style={imageStyle}
    />
  );

  if (!trackRemoteLoading) {
    return image;
  }

  return (
    <View
      style={[style as StyleProp<ViewStyle>, clipRoundedHostStyle(style)]}
      onLayout={
        trackRemoteLoading
          ? (event) => {
              const { width, height } = event.nativeEvent.layout;
              handleHostLayout(width, height);
            }
          : undefined
      }
    >
      {image}
      {shimmerOverlay}
      {showLoadingSpinner && loading && activeUri ? (
        <View style={styles.spinnerHost}>
          <ActivityIndicator size="large" color={loadingSpinnerColor} />
        </View>
      ) : null}
    </View>
  );
}

export const SmartImage = memo(SmartImageInner);

const styles = StyleSheet.create({
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 1,
  },
  spinnerHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
});

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

