import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAiGenerationRealtime } from "../lib/useAiGenerationRealtime";
import { REALTIME_POLL_MS } from "@/shared/realtime/realtimePolling";

export type AiGenerationJobStatus = "pending" | "running" | "done" | "error";

export type AiGenerationJob = {
  id: string;
  user_id: string;
  kind: string;
  status: AiGenerationJobStatus;
  progress: number;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function useAiGenerationJob(jobId: string | null | undefined) {
  const { user } = useAuth();
  const realtimeConnected = useAiGenerationRealtime(user?.id);

  return useQuery({
    queryKey: queryKeys.pixai.generationJob(user?.id ?? null, jobId ?? ""),
    enabled: !!user?.id && !!jobId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      if (realtimeConnected) return false;
      const status = query.state.data?.status;
      if (status === "done" || status === "error") return false;
      return REALTIME_POLL_MS.notifications;
    },
    queryFn: async (): Promise<AiGenerationJob> => {
      const { data, error } = await supabase
        .from("ai_generation_jobs")
        .select("id, user_id, kind, status, progress, result, error, created_at, updated_at")
        .eq("id", jobId!)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data as AiGenerationJob;
    },
  });
}
