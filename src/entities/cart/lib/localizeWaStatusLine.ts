/**
 * Reverse-maps known wa-booking-service status line strings (any locale) to i18n keys.
 * Unknown strings (dynamic content, unreachable errors with phone numbers, etc.) pass through as-is.
 */
const REVERSE_MAP: Record<string, string> = {
  // WA delivery status
  "Сообщение WhatsApp отправлено владельцу.": "waStatus.waSent",
  "WhatsApp message sent to venue.": "waStatus.waSent",
  "Сообщение WhatsApp доставлено владельцу.": "waStatus.waDelivered",
  "WhatsApp message delivered to venue.": "waStatus.waDelivered",
  "Владелец прочитал сообщение WhatsApp.": "waStatus.waRead",
  "Venue read the WhatsApp message.": "waStatus.waRead",
  // WA flow — statusLinesFor
  "Шаблон принят WhatsApp API.": "waStatus.templateAccepted",
  "Template accepted by WhatsApp API.": "waStatus.templateAccepted",
  "Ожидаем ответ владельца…": "waStatus.waitingReply",
  "Waiting for venue reply…": "waStatus.waitingReply",
  "Владелец отклонил этот слот.": "waStatus.slotDeclined",
  "Venue declined this slot.": "waStatus.slotDeclined",
  "Слот доступен.": "waStatus.slotAvailable",
  "Slot available.": "waStatus.slotAvailable",
  "Уточняем стоимость…": "waStatus.checkingCost",
  "Checking if booking is free…": "waStatus.checkingCost",
  "Слот доступен и бесплатный.": "waStatus.slotFreeAvail",
  "Slot available and free.": "waStatus.slotFreeAvail",
  "Можно подтвердить бронь в приложении.": "waStatus.canConfirm",
  "You can confirm the booking in the app.": "waStatus.canConfirm",
  "Цена получена — можно подтвердить в приложении.": "waStatus.priceReceivedConfirm",
  "Price received — you can confirm in the app.": "waStatus.priceReceivedConfirm",
  "Ожидаем цену от владельца…": "waStatus.awaitingPrice",
  "Ожидаем цену от заведения…": "waStatus.awaitingPrice",
  "Awaiting price from venue…": "waStatus.awaitingPrice",
  "Не удалось распознать цену — отправьте только сумму и валюту.": "waStatus.invalidPrice",
  "Could not read price — send amount and currency only.": "waStatus.invalidPrice",
  // SMS
  "Text message sent to venue. Waiting for reply…": "waStatus.smsSent",
  "SMS отправлен в заведение. Ожидаем ответ…": "waStatus.smsSent",
  "Could not send text message to venue. Please contact support.": "waStatus.smsFailed",
  "Не удалось отправить SMS в заведение. Обратитесь в поддержку.": "waStatus.smsFailed",
  "Venue available via SMS. Checking booking fee…": "waStatus.smsAvailPricing",
  "Слот доступен (по SMS). Уточняем стоимость…": "waStatus.smsAvailPricing",
  "Venue declined your booking request by text.": "waStatus.smsDeclined",
  "Заведение отклонило запрос на бронирование по SMS.": "waStatus.smsDeclined",
  "Could not read price — venue should send amount and currency only.": "waStatus.smsInvalidPrice",
  "Не удалось распознать цену — заведение должно отправить только сумму и валюту.": "waStatus.smsInvalidPrice",
};

export function localizeWaStatusLine(line: string, t: (key: string) => string): string {
  const key = REVERSE_MAP[line];
  if (!key) return line;
  const translated = t(key);
  return translated === key ? line : translated;
}
