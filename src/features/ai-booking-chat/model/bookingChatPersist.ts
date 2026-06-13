import AsyncStorage from "@react-native-async-storage/async-storage";
import { createJSONStorage } from "zustand/middleware";
import { syncOpeningTypewriterRegistryFromTabs } from "../lib/bookingOpeningTypewriterRegistry";
import { INITIAL_ONBOARDING_PHASE } from "@/features/ai-booking-onboarding/model/types";
import type { BookingChatTab, BookingSearchSnapshot } from "./types";

export const BOOKING_CHAT_PERSIST_KEY = "pixap-ai-booking-chat-v2";

export type PersistedBookingChatState = {
  catalogRevision: number;
  tabs: BookingChatTab[];
  activeTabId: string | null;
  lastSearchSnapshot: BookingSearchSnapshot | null;
};

export const bookingChatPersistStorage = createJSONStorage<PersistedBookingChatState>(() => AsyncStorage);

function isBookingSearchSnapshot(value: unknown): value is BookingSearchSnapshot {
  if (!value || typeof value !== "object") return false;
  const s = value as BookingSearchSnapshot;
  return (
    typeof s.city === "string" &&
    typeof s.categoryId === "string" &&
    typeof s.categoryName === "string" &&
    typeof s.isRestaurantTable === "boolean" &&
    (s.scope === "nearby" || s.scope === "city") &&
    typeof s.requestComment === "string" &&
    Array.isArray(s.catalogPlaces)
  );
}

function normalizeSearchSnapshot(value: BookingSearchSnapshot): BookingSearchSnapshot {
  return {
    ...value,
    persons: typeof value.persons === "number" ? value.persons : 2,
    searchedAt: typeof value.searchedAt === "number" ? value.searchedAt : Date.now(),
    searchMeta:
      value.searchMeta && typeof value.searchMeta === "object"
        ? {
            is_fallback: Boolean(value.searchMeta.is_fallback),
            fts_matched: Boolean(value.searchMeta.fts_matched),
            original_query:
              typeof value.searchMeta.original_query === "string"
                ? value.searchMeta.original_query
                : null,
          }
        : null,
  };
}

function normalizePersistedTab(tab: BookingChatTab, _fallbackSnapshot: BookingSearchSnapshot | null): BookingChatTab {
  const committed = tab.searchSnapshot
    ? normalizeSearchSnapshot(tab.searchSnapshot)
    : undefined;
  const phase =
    tab.onboardingPhase ??
    (committed ? "gemini" : INITIAL_ONBOARDING_PHASE);
  return {
    ...tab,
    onboardingPhase: phase,
    searchSnapshot: committed,
    messages: Array.isArray(tab.messages) ? tab.messages : [],
  };
}

export function partializeBookingChatPersist(state: PersistedBookingChatState): PersistedBookingChatState {
  return {
    catalogRevision: state.catalogRevision,
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    lastSearchSnapshot: state.lastSearchSnapshot,
  };
}

export function mergePersistedBookingChat(
  persisted: unknown,
  current: PersistedBookingChatState & {
    sendError: string | null;
    isSending: boolean;
    panelOpen: boolean;
  },
): typeof current {
  const p = persisted as Partial<PersistedBookingChatState> | undefined;
  if (!p || typeof p !== "object") return current;

  const rawTabs = Array.isArray(p.tabs) ? p.tabs : [];
  const lastSearchSnapshot = isBookingSearchSnapshot(p.lastSearchSnapshot)
    ? normalizeSearchSnapshot(p.lastSearchSnapshot)
    : null;
  const tabs = rawTabs.map((t) => normalizePersistedTab(t as BookingChatTab, lastSearchSnapshot));

  const activeTabId =
    typeof p.activeTabId === "string" && tabs.some((t) => t.id === p.activeTabId)
      ? p.activeTabId
      : tabs.length > 0
        ? tabs[tabs.length - 1]!.id
        : null;

  if (tabs.length > 0) {
    syncOpeningTypewriterRegistryFromTabs(tabs);
  }

  return {
    ...current,
    catalogRevision: typeof p.catalogRevision === "number" ? p.catalogRevision : 0,
    tabs,
    activeTabId,
    lastSearchSnapshot,
    sendError: null,
    isSending: false,
    panelOpen: false,
  };
}
