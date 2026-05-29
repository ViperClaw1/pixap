import { supabase } from "@/shared/api/supabase/client";
import type { ContentReportReason, ContentReportTargetType, ReportContentPayload } from "../types/moderation";

export async function reportContent(payload: ReportContentPayload): Promise<string> {
  const { data, error } = await supabase.rpc("report_content", {
    p_target_type: payload.targetType as ContentReportTargetType,
    p_reason: payload.reason as ContentReportReason,
    p_target_id: payload.targetId ?? null,
    p_reported_user_id: payload.reportedUserId ?? null,
    p_details: payload.details ?? null,
  });

  if (error) throw error;
  return data as string;
}

export async function blockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc("block_user", { p_blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_user", { p_blocked_id: blockedId });
  if (error) throw error;
}

export async function fetchBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.blocked_id as string);
}

export async function acceptTermsOfService(): Promise<void> {
  const { error } = await supabase.rpc("accept_terms_of_service");
  if (error) throw error;
}
