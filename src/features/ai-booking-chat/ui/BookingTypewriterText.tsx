import { useEffect, useRef, useState } from "react";
import { Platform, Text, type StyleProp, type TextStyle } from "react-native";
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
  /** When set, typewriter runs once per key; calls onComplete when reveal finishes. */
  runOnceKey?: string;
  onComplete?: () => void;
};

/** Client-only progressive reveal; store may already hold the full string. */
export function BookingTypewriterText({
  fullText,
  textStyle,
  tickMs = DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS,
  runOnceKey,
  onComplete,
}: Props) {
  const [visible, setVisible] = useState(() =>
    runOnceKey && isBookingOpeningTypewriterComplete(runOnceKey) ? fullText : "",
  );
  const lastLayoutAt = useRef(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completionNotifiedForKeyRef = useRef<string | null>(null);

  onCompleteRef.current = onComplete;

  const notifyCompleteOnce = () => {
    if (!runOnceKey) {
      onCompleteRef.current?.();
      return;
    }
    if (completionNotifiedForKeyRef.current === runOnceKey) return;
    completionNotifiedForKeyRef.current = runOnceKey;
    onCompleteRef.current?.();
  };

  useEffect(() => {
    if (runOnceKey && isBookingOpeningTypewriterComplete(runOnceKey)) {
      setVisible((current) => (current === fullText ? current : fullText));
      notifyCompleteOnce();
      return;
    }

    completionNotifiedForKeyRef.current = null;

    let cancelled = false;
    let cancelReveal: (() => void) | null = null;

    if (Platform.OS === "android") {
      fallbackTimerRef.current = setTimeout(() => {
        if (!cancelled && fullText.length > 0) {
          setVisible((current) => (current.length > 0 ? current : fullText));
        }
      }, 700);
    }

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
        notifyCompleteOnce();
      }
    };
    void run();
    return () => {
      cancelled = true;
      cancelReveal?.();
      if (fallbackTimerRef.current != null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [fullText, tickMs, runOnceKey]);

  return <Text style={textStyle}>{visible}</Text>;
}
