import { i18n } from "@/shared/lib/i18n";

export function getOnboardingSelectedCityGreetingText(): string {
  return i18n.t("aiBooking.assistantGreetingWithSelectedCity");
}

export function getOnboardingAskCategoryText(): string {
  return i18n.t("aiBooking.askCategory");
}

export function getOnboardingAskScopeText(): string {
  return i18n.t("aiBooking.askScope");
}
