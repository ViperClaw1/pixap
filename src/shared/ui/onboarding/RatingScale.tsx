import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const RATING_PREFIX = "onboarding.rating";

const RATINGS = [
  { value: 1, emoji: "😖", color: "#E53935", labelKey: "hate" },
  { value: 2, emoji: "😕", color: "#FF7043", labelKey: "notForMe" },
  { value: 3, emoji: "😐", color: "#FFA726", labelKey: "neutral" },
  { value: 4, emoji: "😊", color: "#66BB6A", labelKey: "like" },
  { value: 5, emoji: "🤩", color: "#FFD54F", labelKey: "love" },
] as const;

type Props = {
  selected: number | null;
  onSelect: (rating: number) => void;
};

function RatingButton({
  value,
  emoji,
  color,
  label,
  selected,
  onPress,
}: {
  value: number;
  emoji: string;
  color: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.12 : 1, { damping: 14 });
  }, [scale, selected]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Animated.View
        style={[
          styles.circle,
          animStyle,
          {
            backgroundColor: selected ? `${color}33` : "transparent",
            borderColor: selected ? color : "#444",
          },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </Animated.View>
      <Text style={[styles.label, selected && { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function RatingScale({ selected, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {RATINGS.map((r) => (
        <RatingButton
          key={r.value}
          value={r.value}
          emoji={r.emoji}
          color={r.color}
          label={t(r.labelKey, { keyPrefix: RATING_PREFIX })}
          selected={selected === r.value}
          onPress={() => onSelect(r.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    gap: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 26 },
  label: { fontSize: 9, fontWeight: "600", color: "#888", textAlign: "center" },
});
