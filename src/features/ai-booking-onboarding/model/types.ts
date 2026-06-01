export type BookingOnboardingPhase =
  | "greeting"
  | "assistant_typing"
  | "await_city"
  | "await_category"
  | "await_scope"
  | "searching"
  | "search_results"
  | "gemini";

export const INITIAL_ONBOARDING_PHASE: BookingOnboardingPhase = "greeting";
