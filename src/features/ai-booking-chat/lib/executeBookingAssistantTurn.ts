import { defaultBookingChatProvider } from "../api/geminiBookingChatAdapter";
import type { BookingChatContext, PlaceLite } from "../model/types";
import { useBookingChatStore } from "../model/bookingChatStore";
import { buildAssistantReplyText } from "./buildAssistantReplyText";
import { buildBookingChatTabTitleFromUserMessage } from "./buildBookingChatTabTitleFromUserMessage";
import { revealAssistantText } from "./revealAssistantText";
import { sanitizeAiBookingChatResult } from "./sanitizeAiBookingChatResult";
import { scheduleBookingChatLayoutAnimation } from "./scheduleBookingChatLayoutAnimation";

export type BookingChatTurnHistoryItem = { role: "user" | "assistant"; content: string };

export async function executeBookingAssistantTurn(input: {
  tabId: string;
  userText: string;
  catalogRevision: number;
  bookingContext: BookingChatContext;
  places: PlaceLite[];
  orderedIds: string[];
  prior: BookingChatTurnHistoryItem[];
  signal?: AbortSignal;
}): Promise<void> {
  const { tabId, userText, catalogRevision, bookingContext, places, orderedIds, prior, signal } = input;
  const store = useBookingChatStore.getState();

  const isFirstUserTurn = !prior.some((m) => m.role === "user");
  store.appendUserMessage(tabId, userText);
  if (isFirstUserTurn) {
    const tab = useBookingChatStore.getState().tabs.find((t) => t.id === tabId);
    const useGeneratedTitle = tab && (tab.title === "Chat" || tab.title.trim().length === 0);
    if (useGeneratedTitle) {
      const nextTitle = buildBookingChatTabTitleFromUserMessage(userText, bookingContext.city);
      useBookingChatStore.getState().renameTab(tabId, nextTitle);
    }
  }

  store.setSendState({ isSending: true, sendError: null });

  try {
    const raw = await defaultBookingChatProvider.sendTurn({
      bookingContext,
      places,
      history: prior,
      userText,
    });
    const safe = sanitizeAiBookingChatResult(raw, orderedIds);
    const fullText = buildAssistantReplyText(safe);
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
