export type AiBookingChatResult = {
  message: string;
  filters: Record<string, unknown>;
  rerankedPlaceIds: string[];
  excludedPlaceIds: string[];
  explanation?: string;
};
