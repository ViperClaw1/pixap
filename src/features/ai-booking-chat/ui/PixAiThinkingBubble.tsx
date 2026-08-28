import { View } from "react-native";
import { PixAiThinkingText } from "./PixAiThinkingText";
import { useBookingInlineThreadStyles } from "./useBookingInlineThreadStyles";

export function PixAiThinkingBubble() {
  const ts = useBookingInlineThreadStyles();

  return (
    <View style={ts.bubbleWrapPeer}>
      <View style={[ts.bubble, ts.bubblePeer]}>
        <PixAiThinkingText style={ts.bubbleTextPeer} />
      </View>
    </View>
  );
}
