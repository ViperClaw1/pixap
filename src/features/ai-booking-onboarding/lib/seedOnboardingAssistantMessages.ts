import {
  getOnboardingAskCategoryText,
  getOnboardingAskCityText,
  getOnboardingAskScopeText,
  getOnboardingGreetingText,
} from "./onboardingMessages";
import { useBookingChatStore } from "@/features/ai-booking-chat/model/bookingChatStore";

export type OnboardingAssistantStep = "greeting" | "category" | "scope" | "results";

export function onboardingAssistantMessageId(tabId: string, step: OnboardingAssistantStep): string {
  return `onb-${tabId}-${step}`;
}

export function getOnboardingGreetingWithCityPromptText(): string {
  return `${getOnboardingGreetingText()}\n\n${getOnboardingAskCityText()}`;
}

export function getOnboardingGreetingWithCategoryPromptText(): string {
  return `${getOnboardingGreetingText()}\n\n${getOnboardingAskCategoryText()}`;
}

export function seedOnboardingGreetingMessage(tabId: string, skipCityPrompt: boolean): void {
  const content = skipCityPrompt
    ? getOnboardingGreetingWithCategoryPromptText()
    : getOnboardingGreetingWithCityPromptText();
  useBookingChatStore
    .getState()
    .appendAssistantMessageOnce(tabId, onboardingAssistantMessageId(tabId, "greeting"), content);
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
