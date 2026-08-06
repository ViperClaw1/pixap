import { useEffect, useState } from "react";
import {
  isBookingOpeningTypewriterComplete,
  markBookingOpeningTypewriterComplete,
} from "./bookingOpeningTypewriterRegistry";
import { revealAssistantText } from "./revealAssistantText";
import { scheduleBookingChatLayoutAnimation } from "./scheduleBookingChatLayoutAnimation";

/**
 * Types out `firstText` to completion, then types `secondText` (layout-friendly for stacked bubbles).
 * Optional `chainKey`: full sequence runs once per key (e.g. `${first.id}:${second.id}`).
 */
export function useSequentialTypewriterReveal(
  firstText: string,
  secondText: string,
  chainKey?: string | null,
) {
  const alreadyDone = Boolean(chainKey && isBookingOpeningTypewriterComplete(chainKey));
  const [firstVisible, setFirstVisible] = useState(() => (alreadyDone ? firstText : ""));
  const [secondVisible, setSecondVisible] = useState(() => (alreadyDone ? secondText : ""));
  const [showSecondBubble, setShowSecondBubble] = useState(() => alreadyDone);

  useEffect(() => {
    if (chainKey && isBookingOpeningTypewriterComplete(chainKey)) {
      setFirstVisible(firstText);
      setSecondVisible(secondText);
      setShowSecondBubble(true);
      return;
    }

    let cancelled = false;
    let cancelReveal: (() => void) | null = null;

    setFirstVisible("");
    setSecondVisible("");
    setShowSecondBubble(false);

    const run = async () => {
      const firstReveal = revealAssistantText({
        fullText: firstText,
        onUpdate: (partial) => {
          if (cancelled) return;
          setFirstVisible(partial);
        },
      });
      cancelReveal = firstReveal.cancel;
      await firstReveal.promise;
      if (cancelled) return;
      scheduleBookingChatLayoutAnimation();
      setShowSecondBubble(true);
      const secondReveal = revealAssistantText({
        fullText: secondText,
        onUpdate: (partial) => {
          if (cancelled) return;
          setSecondVisible(partial);
        },
      });
      cancelReveal = secondReveal.cancel;
      await secondReveal.promise;
      if (!cancelled) {
        scheduleBookingChatLayoutAnimation();
        if (chainKey) {
          markBookingOpeningTypewriterComplete(chainKey);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      cancelReveal?.();
    };
  }, [firstText, secondText, chainKey]);

  return { firstVisible, secondVisible, showSecondBubble };
}
