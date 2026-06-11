import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  /** Light overlay for grid tiles; dark for fullscreen gallery. */
  variant?: "grid" | "gallery";
};

export function VenuePhotoDeleteButton({
  onPress,
  accessibilityLabel,
  variant = "grid",
}: Props) {
  const isGallery = variant === "gallery";

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        isGallery ? styles.galleryHit : styles.gridHit,
        pressed ? styles.pressed : null,
      ]}
    >
      <Ionicons name="trash-outline" size={isGallery ? 18 : 15} color={isGallery ? "#111111" : "#ffffff"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridHit: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  galleryHit: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  pressed: {
    opacity: 0.88,
  },
});
