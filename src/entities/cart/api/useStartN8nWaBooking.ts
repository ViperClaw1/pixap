import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { normalizeWaInterfaceLocale, startN8nWaBooking, type WaInterfaceLocale } from "../lib/n8nWaBookingStart";

export function useStartN8nWaBooking() {
  const { i18n } = useTranslation();
  return useMutation({
    mutationFn: async ({
      cartItemId,
      accessToken,
      interfaceLocale,
    }: {
      cartItemId: string;
      accessToken: string;
      interfaceLocale?: WaInterfaceLocale;
    }) => {
      const locale = interfaceLocale ?? normalizeWaInterfaceLocale(i18n.language);
      const result = await startN8nWaBooking(cartItemId, accessToken, locale);
      if (!result.ok) {
        throw new Error(result.message);
      }
    },
    retry: 1,
  });
}
