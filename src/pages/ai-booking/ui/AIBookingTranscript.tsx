import { View, Text } from "react-native";
import type { PixAIMessage } from "@/entities/pixai";
import { resolveBookingTranscriptDisplay } from "@/entities/pixai/lib/bookingAssistantCopy";
import type { AIBookingStyles } from "./aiBookingStyles";

type Props = {
  messages: PixAIMessage[];
  styles: AIBookingStyles;
};

export function AIBookingTranscript({ messages, styles: s }: Props) {
  return (
    <View style={s.semanticSection}>
      {messages.map((m) => {
        const content = resolveBookingTranscriptDisplay(m);
        return (
          <View key={m.id} style={[s.bubble, m.role === "user" && s.bubbleUser]}>
            <Text style={m.role === "user" ? s.bubbleUserText : s.bubbleText}>{content}</Text>
          </View>
        );
      })}
    </View>
  );
}
