import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import {
  isBookingOpeningTypewriterComplete,
  markBookingOpeningTypewriterComplete,
} from "../lib/bookingOpeningTypewriterRegistry";
import { revealAssistantText, DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS } from "../lib/revealAssistantText";
import { scheduleBookingChatLayoutAnimation } from "../lib/scheduleBookingChatLayoutAnimation";

type Props = {
  fullText: string;
  textStyle: StyleProp<TextStyle>;
  tickMs?: number;
  /** When set, typewriter runs once per key (e.g. message id); later mounts show full text immediately. */
  runOnceKey?: string;
};

/** Client-only progressive reveal; store may already hold the full string. */
export function BookingTypewriterText({ fullText, textStyle, tickMs = DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS, runOnceKey }: Props) {
  const [visible, setVisible] = useState(() =>
    runOnceKey && isBookingOpeningTypewriterComplete(runOnceKey) ? fullText : "",
  );
  const lastLayoutAt = useRef(0);

  useEffect(() => {
    if (runOnceKey && isBookingOpeningTypewriterComplete(runOnceKey)) {
      setVisible(fullText);
      return;
    }

    let cancelled = false;
    let cancelReveal: (() => void) | null = null;
    const run = async () => {
      const reveal = revealAssistantText({
        fullText,
        tickMs,
        onUpdate: (partial) => {
          if (cancelled) return;
          const now = Date.now();
          if (now - lastLayoutAt.current > 110) {
            lastLayoutAt.current = now;
            scheduleBookingChatLayoutAnimation();
          }
          setVisible(partial);
        },
      });
      cancelReveal = reveal.cancel;
      await reveal.promise;
      if (!cancelled) {
        scheduleBookingChatLayoutAnimation();
        if (runOnceKey) {
          markBookingOpeningTypewriterComplete(runOnceKey);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      cancelReveal?.();
    };
  }, [fullText, tickMs, runOnceKey]);

  return <Text style={textStyle}>{visible}</Text>;
}
