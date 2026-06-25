/** Matches user-facing lines written by wa-booking-service when Meta reports undeliverable. */
export function isWaOwnerUnreachableLines(lines: string[]): boolean {
  return lines.some(
    (line) =>
      /could not reach the venue on whatsapp/i.test(line) ||
      /не удалось связаться с заведением в whatsapp/i.test(line) ||
      /not on whatsapp or cannot receive/i.test(line) ||
      /не зарегистрирован в whatsapp/i.test(line),
  );
}

/** Matches user-facing lines written by smsBookingService when Twilio reports undeliverable (e.g. landline, error 30006). */
export function isSmsDeliveryFailed(lines: string[]): boolean {
  return lines.some(
    (line) =>
      /could not send text message to venue/i.test(line) ||
      /не удалось отправить sms в заведение/i.test(line),
  );
}
