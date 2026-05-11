import { supabase } from "@/shared/api/supabase/client";
import type {
  SendEmailVerificationOtpPayload,
  SendEmailVerificationOtpResponse,
  VerifyEmailOtpPayload,
  VerifyEmailOtpResponse,
} from "../types";

export async function sendEmailVerificationOtp(
  payload: SendEmailVerificationOtpPayload,
): Promise<{ error: string | null; data: SendEmailVerificationOtpResponse | null }> {
  const { data, error } = await supabase.functions.invoke<SendEmailVerificationOtpResponse>("auth-email-verify", {
    body: payload,
  });
  if (error) return { error: error.message, data: null };
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { error: String(data.error), data };
  }
  return { error: null, data: data ?? null };
}

export async function verifyEmailOtp(
  payload: VerifyEmailOtpPayload,
): Promise<{ error: string | null; data: VerifyEmailOtpResponse | null }> {
  const { data, error } = await supabase.functions.invoke<VerifyEmailOtpResponse>("auth-email-verify-otp", {
    body: payload,
  });
  if (error) return { error: error.message, data: null };
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { error: String(data.error), data };
  }
  return { error: null, data: data ?? null };
}
