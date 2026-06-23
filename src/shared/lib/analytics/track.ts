import { posthog } from "./posthog";

// ─── Funnel event catalogue ────────────────────────────────────────────────

export type AuthMethod = "email" | "google" | "apple";
export type BookingSource = "ai_booking" | "vibe_match" | "booking_flow";
export type PaywallReason = "no_credits" | "upgrade";

export function identifyUser(userId: string, traits?: { email?: string; created_at?: string }) {
  posthog?.identify(userId, traits);
}

export function resetAnalyticsIdentity() {
  posthog?.reset();
}

// ── Auth ────────────────────────────────────────────────────────────────────

export function trackSignupStarted() {
  posthog?.capture("signup_started");
}

export function trackSignupCompleted(method: AuthMethod) {
  posthog?.capture("signup_completed", { method });
}

export function trackLoginCompleted(method: AuthMethod) {
  posthog?.capture("login_completed", { method });
}

// ── Profile ─────────────────────────────────────────────────────────────────

export function trackProfileSaved(hasPhone: boolean) {
  posthog?.capture("profile_saved", { has_phone: hasPhone });
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export function trackOnboardingStarted(step: string) {
  posthog?.capture("onboarding_started", { step });
}

export function trackOnboardingStepCompleted(step: string) {
  posthog?.capture("onboarding_step_completed", { step });
}

export function trackOnboardingStepSkipped(step: string) {
  posthog?.capture("onboarding_step_skipped", { step });
}

export function trackOnboardingAbandoned(step: string) {
  posthog?.capture("onboarding_abandoned", { step });
}

export function trackOnboardingCompleted(venueRatings: number) {
  posthog?.capture("onboarding_completed", { venue_ratings: venueRatings });
}

// ── Booking ──────────────────────────────────────────────────────────────────

export function trackBookingScreenOpened(source: BookingSource, venueId: string) {
  posthog?.capture("booking_screen_opened", { source, venue_id: venueId });
}

export function trackBookingStarted(venueId: string, channel: string) {
  posthog?.capture("booking_started", { venue_id: venueId, channel });
}

export function trackBookingConfirmed(venueId: string, channel: string) {
  posthog?.capture("booking_confirmed", { venue_id: venueId, channel });
}

// ── Paywall ──────────────────────────────────────────────────────────────────

export function trackPaywallViewed(reason: PaywallReason, source: BookingSource | "direct") {
  posthog?.capture("paywall_viewed", { reason, source });
}

export function trackPaywallDismissed(reason: PaywallReason) {
  posthog?.capture("paywall_dismissed", { reason });
}

export function trackPurchaseCompleted(sku: string, price?: number | null) {
  posthog?.capture("purchase_completed", { sku, ...(price != null ? { price } : {}) });
}
