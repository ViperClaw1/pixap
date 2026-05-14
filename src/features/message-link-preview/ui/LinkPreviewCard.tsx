import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import type { LinkPreviewData } from "../api/fetchLinkPreview";

type Props = {
  url: string;
  colors: ThemeColors;
  loading: boolean;
  data: LinkPreviewData | null;
};

export function LinkPreviewCard({ url, colors, loading, data }: Props) {
  const open = () => {
    void Linking.openURL(data?.resolvedUrl ?? url);
  };

  if (loading) {
    return (
      <Pressable onPress={open} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]} numberOfLines={1}>
          Loading preview…
        </Text>
      </Pressable>
    );
  }

  if (!data || (!data.title && !data.description && !data.imageUrl)) {
    return null;
  }

  return (
    <Pressable
      onPress={open}
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}
    >
      {data.imageUrl ? (
        <SmartImage uri={data.imageUrl} style={styles.thumb} contentFit="cover" />
      ) : null}
      <View style={styles.textCol}>
        {data.title ? (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {data.title}
          </Text>
        ) : null}
        {data.description ? (
          <Text style={[styles.desc, { color: colors.textMuted }]} numberOfLines={2}>
            {data.description}
          </Text>
        ) : null}
        <Text style={[styles.host, { color: colors.primary }]} numberOfLines={1}>
          {tryHost(data.resolvedUrl)}
        </Text>
      </View>
    </Pressable>
  );
}

function tryHost(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    maxWidth: "100%",
    alignItems: "center",
    padding: 8,
    gap: 10,
  },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.06)" },
  textCol: { flex: 1, minWidth: 0, justifyContent: "center", gap: 4 },
  title: { fontSize: 14, fontWeight: "700" },
  desc: { fontSize: 12 },
  host: { fontSize: 11, fontWeight: "600" },
  loadingText: { marginLeft: 8, flex: 1, fontSize: 12 },
});
