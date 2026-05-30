import { supabase } from "@/shared/api/supabase/client";
import type {
  AdminContentReport,
  AdminContentReportsPage,
  AdminReportStatusFilter,
  ContentReportStatus,
} from "../types/contentReport";

type ListRpcResponse = {
  reports: AdminContentReport[] | null;
  pending_count: number | string | null;
};

export async function fetchAdminContentReports(
  statusFilter: AdminReportStatusFilter,
  limit = 50,
  offset = 0,
): Promise<AdminContentReportsPage> {
  const { data, error } = await supabase.rpc("admin_list_content_reports", {
    p_status: statusFilter === "all" ? null : statusFilter,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const payload = (data ?? { reports: [], pending_count: 0 }) as ListRpcResponse;
  return {
    reports: payload.reports ?? [],
    pending_count: Number(payload.pending_count ?? 0),
  };
}

export async function updateAdminContentReportStatus(
  reportId: string,
  status: Exclude<ContentReportStatus, "pending">,
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_content_report_status", {
    p_report_id: reportId,
    p_status: status,
  });
  if (error) throw error;
}
