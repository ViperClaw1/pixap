import { supabase } from "@/shared/api/supabase/client";

export type AiDataConsentRecord = {
  ai_data_consent_at: string | null;
  ai_data_consent_declined_at: string | null;
};

export async function fetchAiDataConsent(userId: string): Promise<AiDataConsentRecord> {
  const { data, error } = await supabase
    .from("profiles")
    .select("ai_data_consent_at, ai_data_consent_declined_at")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return {
    ai_data_consent_at: (data?.ai_data_consent_at as string | null) ?? null,
    ai_data_consent_declined_at: (data?.ai_data_consent_declined_at as string | null) ?? null,
  };
}

export async function grantAiDataConsent(): Promise<string> {
  const { error } = await supabase.rpc("grant_ai_data_consent");
  if (error) throw error;
  return new Date().toISOString();
}

export async function declineAiDataConsent(): Promise<string> {
  const { error } = await supabase.rpc("decline_ai_data_consent");
  if (error) throw error;
  return new Date().toISOString();
}

export function aiDataConsentStatusFromRecord(record: AiDataConsentRecord): "granted" | "declined" | "pending" {
  if (record.ai_data_consent_at) return "granted";
  if (record.ai_data_consent_declined_at) return "declined";
  return "pending";
}
