import type { StyleProp, TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { BookingTypewriterText } from "./BookingTypewriterText";

type Props = {
  textStyle: StyleProp<TextStyle>;
  /** Assistant message id — animation plays once per message until session reset. */
  runOnceKey: string;
};

/**
 * Client-only typewriter for the canonical PixAI booking greeting (store still holds full text).
 */
export function BookingGreetingTypewriterText({ textStyle, runOnceKey }: Props) {
  const { t } = useTranslation();
  return (
    <BookingTypewriterText
      fullText={t("aiBooking.assistantGreeting")}
      textStyle={textStyle}
      runOnceKey={runOnceKey}
    />
  );
}
