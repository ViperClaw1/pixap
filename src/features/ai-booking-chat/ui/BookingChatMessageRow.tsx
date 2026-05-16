import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { BookingChatMessage } from "../model/types";
import { isPixBookingAssistantGreeting } from "../model/constants";
import { BookingGreetingTypewriterText } from "./BookingGreetingTypewriterText";

type Props = {
  item: BookingChatMessage;
};

export function BookingChatMessageRow({ item }: Props) {
  const { colors } = useAppTheme();
  const isUser = item.role === "user";
  const showGreetingTypewriter = item.role === "assistant" && isPixBookingAssistantGreeting(item.content);

  return (
    <View style={[styles.wrap, isUser ? styles.wrapMine : styles.wrapPeer]}>
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
        ]}
      >
        {showGreetingTypewriter ? (
          <BookingGreetingTypewriterText
            runOnceKey={item.id}
            textStyle={[styles.bubbleText, isUser ? { color: colors.onPrimary } : { color: colors.text }]}
          />
        ) : (
          <Text style={[styles.bubbleText, isUser ? { color: colors.onPrimary } : { color: colors.text }]}>
            {item.content}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  wrapMine: { alignItems: "flex-end" },
  wrapPeer: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
});
