import { create } from "zustand";
import type {
  AiBookingChatResult,
  BookingChatContext,
  BookingChatMessage,
  BookingChatTab,
  BookingRecommendationView,
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

const DEFAULT_GREETING =
  "I can refine this list using only the places shown — tell me vibe, budget, or must-haves.";

function createTab(catalogRevision: number, title?: string): BookingChatTab {
  const id = newTabId();
  const now = Date.now();
  const greeting: BookingChatMessage = {
    id: `m-${now}`,
    role: "assistant",
    content: DEFAULT_GREETING,
    createdAt: now,
  };
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

export type BookingChatStore = {
  panelOpen: boolean;
  catalogRevision: number;
  tabs: BookingChatTab[];
  activeTabId: string | null;
  sendError: string | null;
  isSending: boolean;

  setPanelOpen: (open: boolean) => void;
  /** Called from page when a new place search completes */
  bumpCatalogRevision: (next: number) => void;
  ensureActiveTab: (catalogRevision: number) => void;
  addTab: (catalogRevision: number) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  appendUserMessage: (tabId: string, text: string) => void;
  appendAssistantMessage: (tabId: string, text: string) => void;
  applyAiResult: (tabId: string, result: AiBookingChatResult, catalogRevision: number) => void;
  setSendState: (patch: { isSending?: boolean; sendError?: string | null }) => void;
};

export const useBookingChatStore = create<BookingChatStore>((set) => ({
  panelOpen: false,
  catalogRevision: 0,
  tabs: [],
  activeTabId: null,
  sendError: null,
  isSending: false,

  setPanelOpen: (open) => set({ panelOpen: open }),

  bumpCatalogRevision: (next) =>
    set((s) => {
      if (next === s.catalogRevision) return s;
      return {
        catalogRevision: next,
        tabs: s.tabs.map((t) => ({
          ...t,
          catalogRevision: next,
          recommendationView: emptyView(),
        })),
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
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, title: title.trim() || t.title, updatedAt: Date.now() } : t)),
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

  applyAiResult: (tabId, result, catalogRevision) => {
    const now = Date.now();
    const assistantText =
      result.explanation && result.explanation.trim().length > 0
        ? `${result.message}\n\n${result.explanation}`
        : result.message;
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
}));

export function buildBookingContextFromPage(input: {
  city: string;
  categoryLabel: string;
  scopeLabel: string;
  requestComment?: string;
  selectedPlace: { id: string; name: string } | null;
  bookingDateYmd: string | null;
  selectedSlot: { label: string } | null;
}): BookingChatContext | null {
  if (!input.selectedPlace) return null;
  return {
    city: input.city,
    categoryLabel: input.categoryLabel,
    scopeLabel: input.scopeLabel,
    requestComment: input.requestComment,
    selectedPlaceId: input.selectedPlace.id,
    selectedPlaceName: input.selectedPlace.name,
    bookingDateYmd: input.bookingDateYmd,
    selectedSlotLabel: input.selectedSlot?.label ?? null,
  };
}
