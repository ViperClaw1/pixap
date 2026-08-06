export type AiBookingChatResult = {
  message: string;
  filters: Record<string, unknown>;
  rerankedPlaceIds: string[];
  excludedPlaceIds: string[];
  explanation?: string;
  credits?: {
    balance: number | null;
    charged: number;
  };
};
