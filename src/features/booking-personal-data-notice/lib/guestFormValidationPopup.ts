import type { TFunction } from "i18next";
import { appAlert } from "@/shared/ui/app-popup";
import type { GuestFormFieldError } from "./guestFormValidation";

export function getGuestFormErrorCopy(t: TFunction, error: GuestFormFieldError): { title: string; message: string } {
  const titleByError: Record<GuestFormFieldError, string> = {
    partySize: t("aiBooking.invalidPersonsTitle"),
    name: t("aiBooking.missingDetailsTitle"),
    phone: t("aiBooking.invalidPhoneTitle"),
    email: t("aiBooking.invalidEmailTitle"),
  };
  const messageByError: Record<GuestFormFieldError, string> = {
    partySize: t("aiBooking.invalidPersonsMessage"),
    name: t("bookingCommon.nameRequired"),
    phone: t("bookingCommon.invalidPhone"),
    email: t("bookingCommon.invalidEmail"),
  };
  return { title: titleByError[error], message: messageByError[error] };
}

export function showGuestFormValidationPopup(params: {
  error: GuestFormFieldError;
  t: TFunction;
}): void {
  const { title, message } = getGuestFormErrorCopy(params.t, params.error);
  appAlert(title, message, undefined, "info");
}
