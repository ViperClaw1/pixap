import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import {
  isBookingOpeningTypewriterComplete,
  markBookingOpeningTypewriterComplete,
} from "../lib/bookingOpeningTypewriterRegistry";
import { revealAssistantText, DEFAULT_ASSISTANT_TYPEWRITER_TICK_MS } from "../lib/revealAssistantText";

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
    setVisible("");

    let cancelled = false;
    let cancelReveal: (() => void) | null = null;

    const run = async () => {
      const reveal = revealAssistantText({
        fullText,
        tickMs,
        onUpdate: (partial) => {
          if (cancelled) return;
          setVisible(partial);
        },
      });
      cancelReveal = reveal.cancel;
      await reveal.promise;
      if (!cancelled) {
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
    };
  }, [fullText, tickMs, runOnceKey]);

  return <Text style={textStyle}>{visible}</Text>;
}
