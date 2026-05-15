import type { PixAIPlace } from "@/entities/pixai";

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
};

export type PlaceLite = Pick<PixAIPlace, "id" | "name" | "city" | "rating" | "booking_price">;
