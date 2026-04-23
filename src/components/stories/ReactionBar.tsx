import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryReactionType } from "@/types/stories";

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

function ReactionBarComponent({ activeReaction, reactionCount, onReact }: ReactionBarProps) {
  const { colors } = useAppTheme();
  const countLabel = useMemo(() => `${reactionCount} reactions`, [reactionCount]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {options.map((option) => {
          const active = activeReaction === option.type;
          return (
            <Pressable
              key={option.type}
              style={[
                styles.reactionBtn,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary + "22" : colors.card,
                },
              ]}
              onPress={() => onReact(option.type)}
            >
              <Text style={styles.reactionText}>{option.icon}</Text>
            </Pressable>
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
