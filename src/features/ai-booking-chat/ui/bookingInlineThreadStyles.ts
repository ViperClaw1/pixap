import type { TextStyle, ViewStyle } from "react-native";

/** Subset of message-thread bubble styles passed from the page (no feature → pages import). */
export type BookingInlineThreadStyles = {
  bubbleWrapMine: ViewStyle;
  bubbleWrapPeer: ViewStyle;
  bubble: ViewStyle;
  bubbleMine: ViewStyle;
  bubblePeer: ViewStyle;
  bubbleTextMine: TextStyle;
  bubbleTextPeer: TextStyle;
};
