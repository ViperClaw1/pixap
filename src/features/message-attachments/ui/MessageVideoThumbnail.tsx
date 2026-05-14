import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";

type Props = {
  videoUri: string;
  style?: StyleProp<ViewStyle>;
  iconColor: string;
};

export function MessageVideoThumbnail({ videoUri, style, iconColor }: Props) {
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setThumbUri(null);
    void VideoThumbnails.getThumbnailAsync(videoUri, { time: 400, quality: 0.72 })
      .then((res) => {
        if (cancelled) return;
        setThumbUri(res.uri);
        setPhase("ready");
      })
      .catch(() => {
        if (!cancelled) setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [videoUri]);

  if (phase === "ready" && thumbUri) {
    return <SmartImage uri={thumbUri} style={style} contentFit="cover" />;
  }

  return (
    <View style={[styles.fallback, style]}>
      {phase === "loading" ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <Ionicons name="videocam" size={28} color={iconColor} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
});
