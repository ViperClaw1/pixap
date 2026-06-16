import { defaultBookingChatProvider } from "../api/geminiBookingChatAdapter";
import type { BookingChatContext, PlaceLite } from "../model/types";
import type { PixAISearchMeta } from "@/entities/pixai";
import { useBookingChatStore } from "../model/bookingChatStore";
import { buildAssistantReplyText } from "./buildAssistantReplyText";
import { revealAssistantText } from "./revealAssistantText";
import { sanitizeAiBookingChatResult } from "./sanitizeAiBookingChatResult";
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
}): Promise<void> {
  const { tabId, userText, catalogRevision, bookingContext, places, orderedIds, prior, searchMeta, signal } = input;
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
    const raw = await defaultBookingChatProvider.sendTurn({
      bookingContext,
      places,
      history: prior,
      userText,
      searchMeta,
      locale: i18n.language,
    });
    const safe = sanitizeAiBookingChatResult(raw, orderedIds);
    const fullText = buildAssistantReplyText(safe, { searchMeta });
    const messageId = useBookingChatStore.getState().appendAssistantShellForStream(tabId);

    let lastLayoutAt = 0;
    const reveal = revealAssistantText({
      fullText,
      signal,
      onUpdate: (partial) => {
        if (signal?.aborted) return;
        const now = Date.now();
        if (now - lastLayoutAt > 110) {
          lastLayoutAt = now;
          scheduleBookingChatLayoutAnimation();
        }
        useBookingChatStore.getState().patchAssistantMessageContent(tabId, messageId, partial);
      },
    });
    await reveal.promise;
    if (signal?.aborted) return;

    scheduleBookingChatLayoutAnimation();
    useBookingChatStore.getState().finalizeAssistantStream(tabId, messageId, safe, catalogRevision);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    useBookingChatStore.getState().appendAssistantMessage(tabId, `Sorry — ${msg}. Your place list was not changed.`);
    useBookingChatStore.getState().setSendState({ sendError: msg });
  } finally {
    useBookingChatStore.getState().setSendState({ isSending: false });
  }
}
