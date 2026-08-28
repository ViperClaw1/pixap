import { defaultBookingChatProvider, INSUFFICIENT_AI_CREDITS_ERROR } from "../api/geminiBookingChatAdapter";
import type { BookingChatContext, PlaceLite } from "../model/types";
import type { PixAISearchMeta } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { buildAssistantReplyText } from "./buildAssistantReplyText";
import { revealAssistantText } from "./revealAssistantText";
import { scheduleBookingChatLayoutAnimation } from "./scheduleBookingChatLayoutAnimation";
import { isAiDataConsentGranted, ensureAiDataConsentHydrated } from "@/features/ai-data-consent/model/aiDataConsentState";
import { i18n } from "@/shared/lib/i18n";

export type BookingChatTurnHistoryItem = { role: "user" | "assistant"; content: string };

export async function executeBookingAssistantTurn(input: {
  tabId: string;
  userText: string;
  catalogRevision: number;
  bookingContext: BookingChatContext;
  places: PlaceLite[];
  orderedIds: string[];
  prior: BookingChatTurnHistoryItem[];
  searchMeta?: PixAISearchMeta | null;
  signal?: AbortSignal;
  onCreditsChanged?: (credits: unknown) => void;
}): Promise<void> {
  const {
    tabId,
    userText,
    catalogRevision,
    bookingContext,
    places,
    orderedIds,
    prior,
    searchMeta,
    signal,
    onCreditsChanged,
  } = input;
  await ensureAiDataConsentHydrated();
  if (!isAiDataConsentGranted()) {
    useBookingChatStore.getState().setSendState({
      isSending: false,
      sendError: "AI data consent is required",
    });
    return;
  }
  const store = useBookingChatStore.getState();
  store.appendUserMessage(tabId, userText);

  store.setSendState({ isSending: true, sendError: null });

  try {
    const requestId =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
            const value = Math.floor(Math.random() * 16);
            return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
          });
    const tabBefore = useBookingChatStore.getState().tabs.find((tab) => tab.id === tabId);
    const raw = await defaultBookingChatProvider.sendTurn({
      requestId,
      bookingContext,
      places,
      history: prior,
      userText,
      searchMeta,
      locale: i18n.language,
      previousRerankedPlaceIds:
        tabBefore?.recommendationView.rerankedPlaceIds.length
          ? tabBefore.recommendationView.rerankedPlaceIds
          : orderedIds,
    });
    onCreditsChanged?.(raw.credits);
    const result = raw;
    const fullText = buildAssistantReplyText(result);
    const messageId = useBookingChatStore.getState().appendAssistantShellForStream(tabId);

    const reveal = revealAssistantText({
      fullText,
      signal,
      onUpdate: (partial) => {
        if (signal?.aborted) return;
        useBookingChatStore.getState().patchAssistantMessageContent(tabId, messageId, partial);
      },
    });
    await reveal.promise;
    if (signal?.aborted) return;

    scheduleBookingChatLayoutAnimation();
    useBookingChatStore.getState().finalizeAssistantStream(tabId, messageId, result, catalogRevision);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    if (msg !== INSUFFICIENT_AI_CREDITS_ERROR) {
      useBookingChatStore.getState().appendAssistantMessage(tabId, `Sorry — ${msg}. Your place list was not changed.`);
    }
    useBookingChatStore.getState().setSendState({ sendError: msg });
  } finally {
    useBookingChatStore.getState().setSendState({ isSending: false });
  }
}
