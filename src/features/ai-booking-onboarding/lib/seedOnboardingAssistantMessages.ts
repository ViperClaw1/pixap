import { ALL_CITIES_OPTION } from "@/entities/business-card";
import {
  getOnboardingAskCategoryText,
  getOnboardingAskScopeText,
  getOnboardingSelectedCityGreetingText,
} from "./onboardingMessages";
import { useBookingChatStore } from "@/features/ai-booking-chat/model/bookingChatStore";

export type OnboardingAssistantStep = "greeting" | "category" | "scope" | "results";

export function onboardingAssistantMessageId(tabId: string, step: OnboardingAssistantStep): string {
  return `onb-${tabId}-${step}`;
}

/** City from page state or profile — whichever is available first. */
export function resolveOnboardingCity(selectedCity: string, profileCity?: string | null): string {
  return (selectedCity.trim() || profileCity?.trim() || "");
}

export function hasOnboardingPrefilledCity(
  selectedCity: string,
  profileCity?: string | null,
): boolean {
  const city = resolveOnboardingCity(selectedCity, profileCity);
  return Boolean(city && city !== ALL_CITIES_OPTION);
}

export function seedOnboardingGreetingMessage(tabId: string): void {
  useBookingChatStore
    .getState()
    .appendAssistantMessageOnce(
      tabId,
      onboardingAssistantMessageId(tabId, "greeting"),
      getOnboardingSelectedCityGreetingText(),
    );
}

/** Align an existing greeting with the current locale. */
export function syncOnboardingGreetingMessage(tabId: string): boolean {
  const messageId = onboardingAssistantMessageId(tabId, "greeting");
  const store = useBookingChatStore.getState();
  const tab = store.tabs.find((t) => t.id === tabId);
  const existing = tab?.messages.find((m) => m.id === messageId);
  if (!existing) return false;

  const content = getOnboardingSelectedCityGreetingText();
  if (existing.content === content) return false;

  store.patchAssistantMessageContent(tabId, messageId, content);
  return true;
}

export function seedOnboardingCategoryQuestion(tabId: string): void {
  useBookingChatStore
    .getState()
    .appendAssistantMessageOnce(tabId, onboardingAssistantMessageId(tabId, "category"), getOnboardingAskCategoryText());
}

export function seedOnboardingScopeQuestion(tabId: string): void {
  useBookingChatStore
    .getState()
    .appendAssistantMessageOnce(tabId, onboardingAssistantMessageId(tabId, "scope"), getOnboardingAskScopeText());
}

export function seedOnboardingSearchResultsMessage(tabId: string, content: string): void {
  useBookingChatStore
    .getState()
    .appendAssistantMessageOnce(tabId, onboardingAssistantMessageId(tabId, "results"), content);
}

export function parseOnboardingAssistantStep(messageId: string): OnboardingAssistantStep | null {
  if (messageId.endsWith("-greeting")) return "greeting";
  if (messageId.endsWith("-category")) return "category";
  if (messageId.endsWith("-scope")) return "scope";
  if (messageId.endsWith("-results")) return "results";
  return null;
}
