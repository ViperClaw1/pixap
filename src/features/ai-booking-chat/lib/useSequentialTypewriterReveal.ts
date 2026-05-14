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
    let lastLayoutAt = 0;
    const maybeScheduleLayout = () => {
      const now = Date.now();
      if (now - lastLayoutAt > 110) {
        lastLayoutAt = now;
        scheduleBookingChatLayoutAnimation();
      }
    };

    setFirstVisible("");
    setSecondVisible("");
    setShowSecondBubble(false);

    const run = async () => {
      await revealAssistantText({
        fullText: firstText,
        onUpdate: (partial) => {
          if (cancelled) return;
          maybeScheduleLayout();
          setFirstVisible(partial);
        },
      });
      if (cancelled) return;
      scheduleBookingChatLayoutAnimation();
      setShowSecondBubble(true);
      await revealAssistantText({
        fullText: secondText,
        onUpdate: (partial) => {
          if (cancelled) return;
          maybeScheduleLayout();
          setSecondVisible(partial);
        },
      });
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
    };
  }, [firstText, secondText, chainKey]);

  return { firstVisible, secondVisible, showSecondBubble };
}
