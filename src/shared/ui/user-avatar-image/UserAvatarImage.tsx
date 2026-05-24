import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { getAvatarDisplayUrl } from "@/shared/lib/avatarDisplayUrl";
import { SmartImage, type SmartImageProps } from "@/shared/ui/smart-image/SmartImage";

function hasAvatarUri(uri?: string | null, fallbackUri?: string | null): boolean {
  const check = (value?: string | null) => {
    if (value == null) return false;
    return String(value).trim().length > 0;
  };
  return check(uri) || check(fallbackUri);
}

export type UserAvatarImageProps = Omit<SmartImageProps, "skipBundledPlaceholder" | "onSourcesExhausted"> & {
  iconSize?: number;
  iconColor?: string;
  placeholderBackgroundColor?: string;
  blurhash?: string | null;
};

export function UserAvatarImage({
  uri,
  fallbackUri,
  style,
  iconSize,
  iconColor,
  placeholderBackgroundColor,
  blurhash,
  ...rest
}: UserAvatarImageProps) {
  const { colors } = useAppTheme();
  const flat = StyleSheet.flatten(style);
  const layoutPx = useMemo(() => {
    if (typeof flat?.width === "number") return flat.width;
    if (typeof flat?.height === "number") return flat.height;
    return 40;
  }, [flat?.height, flat?.width]);

  const displayUri = useMemo(
    () => getAvatarDisplayUrl(uri, { layoutPx }) ?? getAvatarDisplayUrl(fallbackUri, { layoutPx }),
    [fallbackUri, layoutPx, uri],
  );
  const rawFallback = useMemo(() => {
    const raw = uri?.trim() || fallbackUri?.trim() || null;
    return raw && displayUri && raw !== displayUri ? raw : undefined;
  }, [displayUri, fallbackUri, uri]);

  const chainKey = `${displayUri ?? ""}|${rawFallback ?? ""}`;
  const [sourcesExhausted, setSourcesExhausted] = useState(false);

  useEffect(() => {
    setSourcesExhausted(false);
  }, [chainKey]);

  const showPlaceholder = sourcesExhausted || !hasAvatarUri(displayUri, rawFallback);
  const resolvedIconSize = iconSize ?? Math.max(14, Math.round(layoutPx * 0.42));

  const placeholderStyle = useMemo(
    () => [
      style,
      {
        backgroundColor: placeholderBackgroundColor ?? colors.card,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        overflow: "hidden" as const,
      },
    ],
    [colors.card, placeholderBackgroundColor, style],
  );

  if (showPlaceholder) {
    return (
      <View style={placeholderStyle}>
        <Ionicons name="person-outline" size={resolvedIconSize} color={iconColor ?? colors.textMuted} />
      </View>
    );
  }

  return (
    <SmartImage
      uri={displayUri}
      fallbackUri={rawFallback}
      style={style}
      skipBundledPlaceholder
      blurhash={blurhash ?? undefined}
      onSourcesExhausted={() => setSourcesExhausted(true)}
      {...rest}
    />
  );
}
