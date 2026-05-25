import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clearBookingOpeningTypewriterRegistry,
  syncOpeningTypewriterRegistryFromTabs,
} from "../lib/bookingOpeningTypewriterRegistry";
import { buildAssistantReplyText } from "../lib/buildAssistantReplyText";
import {
  createBookingAssistantGreetingMessageId,
  getBookingAssistantGreetingText,
} from "@/entities/pixai/lib/bookingAssistantCopy";
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

function assistantMsg(id: string, content: string, createdAt: number): BookingChatMessage {
  return { id, role: "assistant", content, createdAt };
}

function createTab(catalogRevision: number, title?: string): BookingChatTab {
  const id = newTabId();
  const now = Date.now();
  const greeting = assistantMsg(createBookingAssistantGreetingMessageId(now), getBookingAssistantGreetingText(), now);
  return {
    id,
    title: title ?? "Chat",
    createdAt: now,
    updatedAt: now,
    messages: [greeting],
    recommendationView: emptyView(),
    catalogRevision,
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
  /** Bottom-sheet assistant (FAB) visibility */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;

  /** After a new place search: bump revision, reset recommendations, seed opening messages on active tab */
  bumpCatalogRevisionWithOpening: (
    next: number,
    resultsScanLine: string,
    searchSnapshot: BookingSearchSnapshot,
  ) => void;
  ensureActiveTab: (catalogRevision: number) => void;
  addTab: (catalogRevision: number) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  appendUserMessage: (tabId: string, text: string) => void;
  appendAssistantMessage: (tabId: string, text: string) => void;
  applyAiResult: (tabId: string, result: AiBookingChatResult, catalogRevision: number) => void;
  /** Empty assistant bubble; returns message id for streaming patches. */
  appendAssistantShellForStream: (tabId: string) => string;
  patchAssistantMessageContent: (tabId: string, messageId: string, content: string) => void;
  finalizeAssistantStream: (
    tabId: string,
    messageId: string,
    result: AiBookingChatResult,
    catalogRevision: number,
  ) => void;
  setSendState: (patch: { isSending?: boolean; sendError?: string | null }) => void;
  /** Clears chat session (logout / explicit reset). */
  resetBookingSessionForScreenEntry: () => void;
  /** Drops in-flight send state when returning to the screen after background. */
  resetTransientSendState: () => void;
};

export const useBookingChatStore = create<BookingChatStore>()(
  persist(
    (set) => ({
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

      bumpCatalogRevisionWithOpening: (next, resultsScanLine, searchSnapshot) =>
        set((s) => {
          if (next === s.catalogRevision && s.tabs.length > 0) return s;
          const now = Date.now();
          const pair: BookingChatMessage[] = [
            assistantMsg(createBookingAssistantGreetingMessageId(`${now}-1`), getBookingAssistantGreetingText(), now),
            assistantMsg(`a-${now}-2`, resultsScanLine, now + 1),
          ];

          if (s.tabs.length === 0) {
            const id = newTabId();
            const tab: BookingChatTab = {
              id,
              title: "Chat",
              createdAt: now,
              updatedAt: now,
              messages: pair,
              recommendationView: emptyView(),
              catalogRevision: next,
            };
            return {
              tabs: [tab],
              activeTabId: id,
              catalogRevision: next,
              sendError: null,
              lastSearchSnapshot: searchSnapshot,
            };
          }

          const activeId =
            s.activeTabId && s.tabs.some((t) => t.id === s.activeTabId) ? s.activeTabId! : s.tabs[0]!.id;

          return {
            catalogRevision: next,
            lastSearchSnapshot: searchSnapshot,
            tabs: s.tabs.map((t) => {
              const isActive = t.id === activeId;
              return {
                ...t,
                catalogRevision: next,
                recommendationView: emptyView(),
                messages: isActive
                  ? pair
                  : [assistantMsg(createBookingAssistantGreetingMessageId(`g-${t.id}`), getBookingAssistantGreetingText(), now)],
                updatedAt: now,
              };
            }),
          };
        }),

      ensureActiveTab: (catalogRevision) => {
        set((s) => {
          const tabsSynced = s.tabs.map((t) =>
            t.catalogRevision !== catalogRevision
              ? { ...t, catalogRevision, recommendationView: emptyView() }
              : t,
          );
          if (tabsSynced.length === 0) {
            const tab = createTab(catalogRevision);
            return { tabs: [tab], activeTabId: tab.id, catalogRevision };
          }
          const activeOk = s.activeTabId && tabsSynced.some((t) => t.id === s.activeTabId);
          return {
            tabs: tabsSynced,
            activeTabId: activeOk ? s.activeTabId! : tabsSynced[0].id,
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
      },

      closeTab: (tabId) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== tabId);
          if (tabs.length === 0) {
            return { tabs: [], activeTabId: null, sendError: null };
          }
          const nextActive = s.activeTabId === tabId ? tabs[tabs.length - 1].id : s.activeTabId;
          return { tabs, activeTabId: nextActive, sendError: null };
        }),

      setActiveTab: (tabId) => set({ activeTabId: tabId, sendError: null }),

      renameTab: (tabId, title) =>
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === tabId ? { ...t, title: title.trim() || t.title, updatedAt: Date.now() } : t,
          ),
        })),

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
        const assistantText = buildAssistantReplyText(result);
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
        const assistantText = buildAssistantReplyText(result);
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

/** Logout / privacy: wipe persisted assistant tabs and messages. */
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
