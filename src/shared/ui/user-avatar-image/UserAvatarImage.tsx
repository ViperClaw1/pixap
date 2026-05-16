import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/app/providers/ThemeProvider";
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
};

export function UserAvatarImage({
  uri,
  fallbackUri,
  style,
  iconSize,
  iconColor,
  placeholderBackgroundColor,
  ...rest
}: UserAvatarImageProps) {
  const { colors } = useAppTheme();
  const chainKey = `${uri ?? ""}|${fallbackUri ?? ""}`;
  const [sourcesExhausted, setSourcesExhausted] = useState(false);

  useEffect(() => {
    setSourcesExhausted(false);
  }, [chainKey]);

  const showPlaceholder = sourcesExhausted || !hasAvatarUri(uri, fallbackUri);
  const flat = StyleSheet.flatten(style);
  const dimension =
    typeof flat?.width === "number"
      ? flat.width
      : typeof flat?.height === "number"
        ? flat.height
        : 40;
  const resolvedIconSize = iconSize ?? Math.max(14, Math.round(dimension * 0.42));

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
      uri={uri}
      fallbackUri={fallbackUri}
      style={style}
      skipBundledPlaceholder
      onSourcesExhausted={() => setSourcesExhausted(true)}
      {...rest}
    />
  );
}
