import { memo } from "react";
import { StyleSheet, type ImageStyle, type StyleProp } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";

export type StoryArchiveGridThumbProps = {
  uri: string;
  /** Original storage URL when `uri` is a Supabase render transform that may fail. */
  fallbackUri?: string | null;
  recyclingKey?: string;
  style?: StyleProp<ImageStyle>;
};

/** Thumbnail for archive grid (tab 1) via expo-image. */
function StoryArchiveGridThumbComponent({ uri, fallbackUri, recyclingKey, style }: StoryArchiveGridThumbProps) {
  return (
    <SmartImage
      uri={uri}
      fallbackUri={fallbackUri}
      contentFit="cover"
      priority="low"
      recyclingKey={recyclingKey ?? uri}
      skipBundledPlaceholder
      transition={0}
      style={[styles.fill, style]}
    />
  );
}

export const StoryArchiveGridThumb = memo(StoryArchiveGridThumbComponent);

const styles = StyleSheet.create({
  fill: { width: "100%", height: "100%" },
});
