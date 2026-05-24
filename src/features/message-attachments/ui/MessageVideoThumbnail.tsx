import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrlPreset } from "@/shared/lib/imagePresets";
import { getMessageVideoPosterPublicUrl } from "@/entities/messages/lib/messageVideoPoster";

const LOCAL_SCHEMES = /^(file|content|ph|assets-library):/i;

type Props = {
  videoUri: string;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
  blurhash?: string | null;
};

export function MessageVideoThumbnail({ videoUri, style, iconColor, blurhash }: Props) {
  const posterUrl = useMemo(() => getMessageVideoPosterPublicUrl(videoUri), [videoUri]);
  const optimizedPoster = useMemo(
    () => (posterUrl ? getOptimizedImageUrlPreset(posterUrl, "small", { quality: 72 }) || posterUrl : null),
    [posterUrl],
  );

  const isLocal = LOCAL_SCHEMES.test(videoUri.trim());
  const [localThumbUri, setLocalThumbUri] = useState<string | null>(null);
  const [localPhase, setLocalPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (optimizedPoster || !isLocal) {
      setLocalThumbUri(null);
      setLocalPhase("idle");
      return;
    }
    let cancelled = false;
    setLocalPhase("loading");
    setLocalThumbUri(null);
    void VideoThumbnails.getThumbnailAsync(videoUri, { time: 400, quality: 0.72 })
      .then((res) => {
        if (cancelled) return;
        setLocalThumbUri(res.uri);
        setLocalPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setLocalPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [videoUri, optimizedPoster, isLocal]);

  if (optimizedPoster) {
    return (
      <View style={style}>
        <SmartImage
          uri={optimizedPoster}
          fallbackUri={posterUrl ?? undefined}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          recyclingKey={optimizedPoster}
          blurhash={blurhash ?? undefined}
        />
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={22} color="#fff" />
        </View>
      </View>
    );
  }

  if (isLocal && localPhase === "ready" && localThumbUri) {
    return (
      <View style={style}>
        <SmartImage uri={localThumbUri} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <View style={styles.playBadge} pointerEvents="none">
          <Ionicons name="play" size={22} color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fallback, style]}>
      {isLocal && localPhase === "loading" ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          <Ionicons name="videocam" size={28} color={iconColor} />
          <View style={styles.playBadgeSmall} pointerEvents="none">
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  playBadgeSmall: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
