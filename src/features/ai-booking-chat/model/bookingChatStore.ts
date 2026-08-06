import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clearBookingOpeningTypewriterKeys,
  clearBookingOpeningTypewriterRegistry,
  syncOpeningTypewriterRegistryFromTabs,
} from "../lib/bookingOpeningTypewriterRegistry";
import { collectOpeningTypewriterKeysFromMessages } from "../lib/collectOpeningTypewriterKeys";
import { buildAssistantReplyText } from "../lib/buildAssistantReplyText";
import { buildHistoryTitleFromSnapshot } from "@/features/ai-booking-request-history/lib/buildHistoryItem";
import {
  INITIAL_ONBOARDING_PHASE,
  type BookingOnboardingPhase,
} from "@/features/ai-booking-onboarding/model/types";
import {
  bookingChatPersistStorage,
  BOOKING_CHAT_PERSIST_KEY,
  mergePersistedBookingChat,
  partializeBookingChatPersist,
} from "./bookingChatPersist";
import type {
  AiBookingChatResult,
  BookingChatContext,
  BookingChatMessage,
  BookingChatTab,
  BookingRecommendationView,
  BookingSearchSnapshot,
} from "./types";

const emptyView = (): BookingRecommendationView => ({
  rerankedPlaceIds: [],
  excludedPlaceIds: [],
  filters: {},
});

function newTabId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTab(catalogRevision: number, title?: string): BookingChatTab {
  const id = newTabId();
  const now = Date.now();
  return {
    id,
    title: title ?? "Chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
    recommendationView: emptyView(),
    catalogRevision,
    onboardingPhase: INITIAL_ONBOARDING_PHASE,
  };
}

function normalizeTab(tab: BookingChatTab, fallbackSnapshot: BookingSearchSnapshot | null): BookingChatTab {
  const committed = tab.searchSnapshot;
  const phase =
    tab.onboardingPhase ??
    (committed ? "gemini" : INITIAL_ONBOARDING_PHASE);
  return {
    ...tab,
    onboardingPhase: phase,
    searchSnapshot: committed,
    messages: Array.isArray(tab.messages) ? tab.messages : [],
    recommendationView: tab.recommendationView ?? emptyView(),
  };
}

const ephemeralDefaults = {
  sendError: null as string | null,
  isSending: false,
  panelOpen: false,
};

export type BookingChatStore = {
  catalogRevision: number;
  tabs: BookingChatTab[];
  activeTabId: string | null;
  lastSearchSnapshot: BookingSearchSnapshot | null;
  sendError: string | null;
  isSending: boolean;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;

  applySearchResults: (next: number, searchSnapshot: BookingSearchSnapshot) => void;
  commitSearchSnapshot: (tabId: string, searchSnapshot: BookingSearchSnapshot) => void;
  ensureActiveTab: (catalogRevision: number) => void;
  addTab: (catalogRevision: number) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  setTabOnboardingPhase: (tabId: string, phase: BookingOnboardingPhase) => void;
  appendAssistantMessageOnce: (tabId: string, messageId: string, text: string) => void;
  appendUserMessage: (tabId: string, text: string) => void;
  appendAssistantMessage: (tabId: string, text: string) => void;
  applyAiResult: (tabId: string, result: AiBookingChatResult, catalogRevision: number) => void;
  appendAssistantShellForStream: (tabId: string) => string;
  patchAssistantMessageContent: (tabId: string, messageId: string, content: string) => void;
  finalizeAssistantStream: (
    tabId: string,
    messageId: string,
    result: AiBookingChatResult,
    catalogRevision: number,
  ) => void;
  setSendState: (patch: { isSending?: boolean; sendError?: string | null }) => void;
  resetBookingSessionForScreenEntry: () => void;
  resetTransientSendState: () => void;
  /** Clears messages and onboarding state on the active tab. */
  resetActiveTabChat: () => void;
};

export const useBookingChatStore = create<BookingChatStore>()(
  persist(
    (set, get) => ({
      catalogRevision: 0,
      tabs: [],
      activeTabId: null,
      lastSearchSnapshot: null,
      ...ephemeralDefaults,

      setPanelOpen: (open) => set({ panelOpen: open }),

      resetTransientSendState: () =>
        set({
          isSending: false,
          sendError: null,
        }),

      resetBookingSessionForScreenEntry: () => {
        clearBookingOpeningTypewriterRegistry();
        set({
          tabs: [],
          activeTabId: null,
          sendError: null,
          isSending: false,
          panelOpen: false,
          catalogRevision: 0,
          lastSearchSnapshot: null,
        });
      },

      commitSearchSnapshot: (tabId, searchSnapshot) =>
        set((s) => {
          const title = buildHistoryTitleFromSnapshot(searchSnapshot);
          return {
            lastSearchSnapshot: searchSnapshot,
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    title,
                    searchSnapshot,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }),

      applySearchResults: (next, searchSnapshot) =>
        set((s) => {
          const activeId =
            s.activeTabId && s.tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId! : s.tabs[0]?.id;
          const title = buildHistoryTitleFromSnapshot(searchSnapshot);
          if (!activeId) {
            return {
              catalogRevision: next,
              lastSearchSnapshot: searchSnapshot,
            };
          }
          return {
            catalogRevision: next,
            lastSearchSnapshot: searchSnapshot,
            tabs: s.tabs.map((t) =>
              t.id === activeId
                ? {
                    ...t,
                    title,
                    catalogRevision: next,
                    recommendationView: emptyView(),
                    searchSnapshot,
                    onboardingPhase: "search_results" as const,
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        }),

      ensureActiveTab: (catalogRevision) => {
        set((s) => {
          const tabsSynced = s.tabs.map((t) =>
            normalizeTab(
              t.catalogRevision !== catalogRevision
                ? { ...t, catalogRevision, recommendationView: emptyView() }
                : t,
              s.lastSearchSnapshot,
            ),
          );
          if (tabsSynced.length === 0) {
            const tab = createTab(catalogRevision);
            return { tabs: [tab], activeTabId: tab.id, catalogRevision };
          }
          const activeOk = s.activeTabId && tabsSynced.some((t) => t.id === s.activeTabId);
          return {
            tabs: tabsSynced,
            activeTabId: activeOk ? s.activeTabId! : tabsSynced[0]!.id,
            catalogRevision,
          };
        });
      },

      addTab: (catalogRevision) => {
        const tab = createTab(catalogRevision);
        set((s) => ({
          tabs: [...s.tabs, tab],
          activeTabId: tab.id,
          catalogRevision,
        }));
        return tab.id;
      },

      closeTab: (tabId) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== tabId);
          if (tabs.length === 0) {
            return { tabs: [], activeTabId: null, sendError: null };
          }
          const nextActive = s.activeTabId === tabId ? tabs[tabs.length - 1]!.id : s.activeTabId;
          return { tabs, activeTabId: nextActive, sendError: null };
        }),

      setActiveTab: (tabId) => set({ activeTabId: tabId, sendError: null }),

      setTabOnboardingPhase: (tabId, phase) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, onboardingPhase: phase, updatedAt: Date.now() } : t,
          ),
        })),

      renameTab: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, title: title.trim() || t.title, updatedAt: Date.now() } : t,
          ),
        })),

      appendAssistantMessageOnce: (tabId, messageId, text) => {
        const now = Date.now();
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            if (t.messages.some((m) => m.id === messageId)) return t;
            const msg: BookingChatMessage = {
              id: messageId,
              role: "assistant",
              content: text,
              createdAt: now,
            };
            return { ...t, messages: [...t.messages, msg], updatedAt: now };
          }),
        }));
      },

      resetActiveTabChat: () => {
        const { tabs, activeTabId } = get();
        const activeTab = tabs.find((tab) => tab.id === activeTabId);
        if (activeTab) {
          clearBookingOpeningTypewriterKeys(collectOpeningTypewriterKeysFromMessages(activeTab.messages));
        }
        set((s) => {
          const tabId = s.activeTabId;
          if (!tabId) return { sendError: null };
          return {
            sendError: null,
            tabs: s.tabs.map((t) =>
              t.id === tabId
                ? {
                    ...t,
                    messages: [],
                    onboardingPhase: INITIAL_ONBOARDING_PHASE,
                    searchSnapshot: undefined,
                    recommendationView: emptyView(),
                    updatedAt: Date.now(),
                  }
                : t,
            ),
          };
        });
      },

      appendUserMessage: (tabId, text) => {
        const now = Date.now();
        const msg: BookingChatMessage = {
          id: `u-${now}`,
          role: "user",
          content: text,
          createdAt: now,
        };
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, messages: [...t.messages, msg], updatedAt: now } : t,
          ),
        }));
      },

      appendAssistantMessage: (tabId, text) => {
        const now = Date.now();
        const msg: BookingChatMessage = {
          id: `a-${now}`,
          role: "assistant",
          content: text,
          createdAt: now,
        };
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, messages: [...t.messages, msg], updatedAt: now } : t,
          ),
        }));
      },

      appendAssistantShellForStream: (tabId) => {
        const now = Date.now();
        const id =
          typeof globalThis.crypto?.randomUUID === "function"
            ? `a-stream-${globalThis.crypto.randomUUID()}`
            : `a-stream-${now}-${Math.random().toString(36).slice(2, 9)}`;
        const msg: BookingChatMessage = { id, role: "assistant", content: "", createdAt: now };
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, messages: [...t.messages, msg], updatedAt: now } : t,
          ),
        }));
        return id;
      },

      patchAssistantMessageContent: (tabId, messageId, content) => {
        const now = Date.now();
        set((s) => ({
          tabs: s.tabs.map((t) => {
            if (t.id !== tabId) return t;
            return {
              ...t,
              messages: t.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
              updatedAt: now,
            };
          }),
        }));
      },

      finalizeAssistantStream: (tabId, messageId, result, catalogRevision) => {
        const now = Date.now();
        const state = get();
        const tab = state.tabs.find((t) => t.id === tabId);
        const searchMeta = tab?.searchSnapshot?.searchMeta ?? state.lastSearchSnapshot?.searchMeta ?? null;
        const assistantText = buildAssistantReplyText(result, { searchMeta });
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  messages: t.messages.map((m) =>
                    m.id === messageId ? { ...m, content: assistantText, createdAt: m.createdAt } : m,
                  ),
                  updatedAt: now,
                  catalogRevision,
                  recommendationView: {
                    rerankedPlaceIds: result.rerankedPlaceIds,
                    excludedPlaceIds: result.excludedPlaceIds,
                    filters: result.filters ?? {},
                  },
                }
              : t,
          ),
          catalogRevision,
        }));
      },

      applyAiResult: (tabId, result, catalogRevision) => {
        const now = Date.now();
        const state = get();
        const tab = state.tabs.find((t) => t.id === tabId);
        const searchMeta = tab?.searchSnapshot?.searchMeta ?? state.lastSearchSnapshot?.searchMeta ?? null;
        const assistantText = buildAssistantReplyText(result, { searchMeta });
        const msg: BookingChatMessage = {
          id: `a-${now}`,
          role: "assistant",
          content: assistantText,
          createdAt: now,
        };
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  messages: [...t.messages, msg],
                  updatedAt: now,
                  catalogRevision,
                  recommendationView: {
                    rerankedPlaceIds: result.rerankedPlaceIds,
                    excludedPlaceIds: result.excludedPlaceIds,
                    filters: result.filters ?? {},
                  },
                }
              : t,
          ),
          catalogRevision,
        }));
      },

      setSendState: (patch) =>
        set((s) => ({
          isSending: patch.isSending ?? s.isSending,
          sendError: patch.sendError !== undefined ? patch.sendError : s.sendError,
        })),
    }),
    {
      name: BOOKING_CHAT_PERSIST_KEY,
      storage: bookingChatPersistStorage,
      partialize: partializeBookingChatPersist,
      merge: (persisted, current) =>
        mergePersistedBookingChat(persisted, {
          ...current,
          ...ephemeralDefaults,
        }),
      onRehydrateStorage: () => (state) => {
        if (state?.tabs.length) {
          syncOpeningTypewriterRegistryFromTabs(state.tabs);
        }
      },
    },
  ),
);

export async function resetBookingChatPersistedSession(): Promise<void> {
  useBookingChatStore.getState().resetBookingSessionForScreenEntry();
  await useBookingChatStore.persist.clearStorage();
}

export function buildBookingContextFromPage(input: {
  city: string;
  categoryLabel: string;
  scopeLabel: string;
  requestComment?: string;
  selectedPlace: { id: string; name: string } | null;
  bookingDateYmd: string | null;
  selectedSlot: { label: string } | null;
}): BookingChatContext | null {
  if (!input.city?.trim()) return null;
  const sel = input.selectedPlace;
  return {
    city: input.city.trim(),
    categoryLabel: input.categoryLabel,
    scopeLabel: input.scopeLabel,
    requestComment: input.requestComment,
    selectedPlaceId: sel?.id ?? "",
    selectedPlaceName: sel?.name ?? "",
    bookingDateYmd: input.bookingDateYmd,
    selectedSlotLabel: input.selectedSlot?.label ?? null,
  };
}
