import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { StoryGroup } from "@/types/stories";

interface StoryBubbleProps {
  group: StoryGroup;
  viewed: boolean;
  onPress: () => void;
  variant?: "story" | "add";
}

function StoryBubbleComponent({ group, viewed, onPress, variant = "story" }: StoryBubbleProps) {
  const { colors } = useAppTheme();
  const isAdd = variant === "add";
  const name = useMemo(() => {
    if (isAdd) return "Add Story";
    const first = group.profile?.first_name?.trim();
    const last = group.profile?.last_name?.trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
    return "User";
  }, [group.profile?.first_name, group.profile?.last_name, isAdd]);

  return (
    <Pressable style={styles.wrapper} onPress={onPress}>
      <View
        style={[
          styles.ring,
          {
            borderColor: isAdd ? colors.primary : viewed ? colors.border : colors.primary,
          },
        ]}
      >
        {isAdd ? (
          <View style={[styles.addCircle, { backgroundColor: colors.primary }]}>
            <Text style={[styles.addIcon, { color: colors.onPrimary }]}>+</Text>
          </View>
        ) : (
          <SmartImage
            uri={group.profile?.avatar_url}
            style={styles.avatar}
            contentFit="cover"
            transition={120}
            recyclingKey={`${group.user_id}-story-avatar`}
          />
        )}
      </View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

export const StoryBubble = memo(StoryBubbleComponent);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    width: 76,
    marginRight: 10,
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  addCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  addIcon: {
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 28,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
