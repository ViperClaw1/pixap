import { memo } from "react";
import { Text, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { BookingChatMessage } from "../model/types";

type Props = {
  item: BookingChatMessage;
  colors: ThemeColors;
};

function BookingChatMessageRowInner({ item, colors }: Props) {
  const isUser = item.role === "user";
  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        marginBottom: 8,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: isUser ? colors.primary : colors.card,
        borderWidth: isUser ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: isUser ? colors.onPrimary : colors.text, fontSize: 15 }}>{item.content}</Text>
    </View>
  );
}

export const BookingChatMessageRow = memo(BookingChatMessageRowInner);
