import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMessageThreadStyles } from "@/shared/theme/messageThreadStyles";
import type { BookingInlineThreadStyles } from "./bookingInlineThreadStyles";

/** Message-thread bubble styles for inline booking assistant (no page → feature style import). */
export function useBookingInlineThreadStyles(): BookingInlineThreadStyles {
  const insets = useSafeAreaInsets();
  const stableBottomInset = Math.max(insets.bottom, 6);
  const messageThreadStyles = useMessageThreadStyles(insets.top, stableBottomInset);

  return useMemo(
    (): BookingInlineThreadStyles => ({
      bubbleWrapMine: messageThreadStyles.bubbleWrapMine,
      bubbleWrapPeer: messageThreadStyles.bubbleWrapPeer,
      bubble: messageThreadStyles.bubble,
      bubbleMine: messageThreadStyles.bubbleMine,
      bubblePeer: messageThreadStyles.bubblePeer,
      bubbleTextMine: messageThreadStyles.bubbleTextMine,
      bubbleTextPeer: messageThreadStyles.bubbleTextPeer,
    }),
    [messageThreadStyles],
  );
}
