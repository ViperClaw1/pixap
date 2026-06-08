import type { TFunction } from "i18next";
import { appAlert } from "@/shared/ui/app-popup";

export function showMissingBookingDatePopup(t: TFunction): void {
  appAlert(
    t("bookingCommon.missingBookingSelectionTitle"),
    t("bookingCommon.missingBookingDateMessage"),
    undefined,
    "info",
  );
}

export function showMissingBookingSlotPopup(t: TFunction): void {
  appAlert(
    t("bookingCommon.missingBookingSelectionTitle"),
    t("bookingCommon.missingBookingSlotMessage"),
    undefined,
    "info",
  );
}

export function showMissingAvailableSlotPopup(t: TFunction): void {
  appAlert(
    t("bookingCommon.missingBookingSelectionTitle"),
    t("bookingCommon.missingAvailableSlotMessage"),
    undefined,
    "info",
  );
}
