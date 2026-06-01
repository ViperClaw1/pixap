import { Text, View } from "react-native";
import type { BookingChatMessage } from "../model/types";
import { isPixBookingAssistantGreeting } from "../model/constants";
import { resolveBookingTranscriptDisplay } from "@/entities/pixai/lib/bookingAssistantCopy";
import { BookingTypewriterText } from "./BookingTypewriterText";
import { BookingGreetingTypewriterText } from "./BookingGreetingTypewriterText";
import { useBookingInlineThreadStyles } from "./useBookingInlineThreadStyles";
import { AssistantMessageMeta } from "@/features/ai-data-consent";

type Props = {
  messages: BookingChatMessage[];
  onOnboardingTypewriterComplete?: (messageId: string) => void;
};

function isOnboardingAssistantMessage(messageId: string): boolean {
  return messageId.startsWith("onb-");
}

export function BookingChatMessageList({ messages, onOnboardingTypewriterComplete }: Props) {
  const ts = useBookingInlineThreadStyles();

  return (
    <>
      {messages.map((item) => {
        const isUser = item.role === "user";
        const greetingTw = !isUser && isPixBookingAssistantGreeting(item);
        const onboardingTw = !isUser && isOnboardingAssistantMessage(item.id);

        return (
          <View key={item.id}>
            <View style={isUser ? ts.bubbleWrapMine : ts.bubbleWrapPeer}>
              <View style={[ts.bubble, isUser ? ts.bubbleMine : ts.bubblePeer]}>
                {greetingTw ? (
                  <BookingGreetingTypewriterText
                    runOnceKey={item.id}
                    textStyle={isUser ? ts.bubbleTextMine : ts.bubbleTextPeer}
                  />
                ) : onboardingTw ? (
                  <BookingTypewriterText
                    runOnceKey={item.id}
                    fullText={item.content}
                    textStyle={isUser ? ts.bubbleTextMine : ts.bubbleTextPeer}
                    onComplete={() => onOnboardingTypewriterComplete?.(item.id)}
                  />
                ) : (
                  <Text style={isUser ? ts.bubbleTextMine : ts.bubbleTextPeer}>
                    {resolveBookingTranscriptDisplay(item)}
                  </Text>
                )}
              </View>
            </View>
            {!isUser ? <AssistantMessageMeta messageId={item.id} /> : null}
          </View>
        );
      })}
    </>
  );
}
