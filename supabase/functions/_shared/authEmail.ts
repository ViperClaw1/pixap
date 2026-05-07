import { corsHeaders } from "./cors.ts";

export function jsonHeaders() {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

export function normalizeEmail(email: string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function withFlowQuery(redirectTo: string, flow: "verify" | "recovery"): string {
  return `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}flow=${flow}`;
}
