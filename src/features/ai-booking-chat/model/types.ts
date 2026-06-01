import type { PixAIPlace } from "@/entities/pixai";
import type { BookingOnboardingPhase } from "@/features/ai-booking-onboarding/model/types";

export type BookingChatMessageRole = "user" | "assistant" | "system";

export type BookingChatMessage = {
  id: string;
  role: BookingChatMessageRole;
  content: string;
  createdAt: number;
};

/** Snapshot passed to AI and stored per tab (lightweight). */
export type BookingChatContext = {
  city: string;
  categoryLabel: string;
  scopeLabel: string;
  requestComment?: string;
  selectedPlaceId: string;
  selectedPlaceName: string;
  bookingDateYmd: string | null;
  selectedSlotLabel: string | null;
};

export type BookingRecommendationView = {
  rerankedPlaceIds: string[];
  excludedPlaceIds: string[];
  filters: Record<string, unknown>;
};

export type { AiBookingChatResult } from "@/entities/pixai/model/aiBookingChatTypes";

export type BookingChatTab = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: BookingChatMessage[];
  recommendationView: BookingRecommendationView;
  /** Matches page `catalogRevision` when this tab last applied AI view */
  catalogRevision: number;
  onboardingPhase: BookingOnboardingPhase;
  searchSnapshot?: BookingSearchSnapshot;
};

export type PlaceLite = Pick<PixAIPlace, "id" | "name" | "city" | "rating" | "booking_price">;

/** Last successful orchestrator search — restores place list after app restart. */
export type BookingSearchSnapshot = {
  city: string;
  categoryId: string;
  categoryName: string;
  isRestaurantTable: boolean;
  scope: "nearby" | "city";
  requestComment: string;
  catalogPlaces: PixAIPlace[];
  persons: number;
  searchedAt: number;
};
