import { i18n } from "@/shared/lib/i18n";

export function getOnboardingGreetingText(): string {
  return i18n.t("aiBooking.assistantGreeting");
}

export function getOnboardingAskCityText(): string {
  return i18n.t("aiBooking.askCity");
}

export function getOnboardingAskCategoryText(): string {
  return i18n.t("aiBooking.askCategory");
}

export function getOnboardingAskScopeText(): string {
  return i18n.t("aiBooking.askScope");
}
