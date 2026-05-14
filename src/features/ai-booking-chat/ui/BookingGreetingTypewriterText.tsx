import type { StyleProp, TextStyle } from "react-native";
import { BOOKING_ASSISTANT_GREETING } from "../model/constants";
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
  return <BookingTypewriterText fullText={BOOKING_ASSISTANT_GREETING} textStyle={textStyle} runOnceKey={runOnceKey} />;
}
