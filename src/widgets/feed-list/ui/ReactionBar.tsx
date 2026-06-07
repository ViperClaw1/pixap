import { memo, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { StoryReactionType } from "@/shared/model/types/stories";

interface ReactionBarProps {
  activeReaction: StoryReactionType | null;
  reactionCount: number;
  onReact: (type: StoryReactionType) => void;
}

const options: Array<{ type: StoryReactionType; icon: string }> = [
  { type: "like", icon: "👍" },
  { type: "dislike", icon: "👎" },
  { type: "sticker", icon: "🎭" },
];

function AnimatedReactionButton({
  icon,
  active,
  borderColor,
  backgroundColor,
  onPress,
}: {
  icon: string;
  active: boolean;
  borderColor: string;
  backgroundColor: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.5,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.reactionBtn,
          {
            borderColor,
            backgroundColor,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={styles.reactionText}>{icon}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ReactionBarComponent({ activeReaction, reactionCount, onReact }: ReactionBarProps) {
  const { colors } = useAppTheme();
  const countLabel = useMemo(() => `${reactionCount} reactions`, [reactionCount]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {options.map((option) => {
          const active = activeReaction === option.type;
          return (
            <AnimatedReactionButton
              key={option.type}
              icon={option.icon}
              active={active}
              borderColor={active ? colors.primary : colors.border}
              backgroundColor={active ? colors.primary + "22" : colors.card}
              onPress={() => onReact(option.type)}
            />
          );
        })}
      </View>
      <Text style={[styles.countText, { color: colors.textMuted }]}>{countLabel}</Text>
    </View>
  );
}

export const ReactionBar = memo(ReactionBarComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  reactionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionText: {
    fontSize: 20,
  },
  countText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
