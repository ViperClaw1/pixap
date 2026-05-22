import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useRealtimeChannel } from "@/shared/realtime/useRealtimeChannel";
import { realtimeEventBus } from "@/shared/realtime/eventBus";
import type { AiGenerationJobRow } from "@/shared/realtime/events";
import type { AiGenerationJob } from "../api/useAiGenerationJob";

function parseJobRow(payload: {
  new?: Partial<AiGenerationJobRow>;
  old?: Partial<AiGenerationJobRow>;
}): AiGenerationJob | null {
  const row = payload.new ?? payload.old;
  if (!row?.id || !row.user_id) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    kind: String(row.kind ?? ""),
    status: (row.status as AiGenerationJob["status"]) ?? "pending",
    progress: Number(row.progress ?? 0),
    result: row.result ?? null,
    error: (row.error as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function patchJobCache(queryClient: ReturnType<typeof useQueryClient>, userId: string, job: AiGenerationJob): void {
  queryClient.setQueryData(queryKeys.pixai.generationJob(userId, job.id), job);
}

function emitJobEvents(job: AiGenerationJob, prevStatus?: string): void {
  if (job.status === "running" && prevStatus !== "running") {
    realtimeEventBus.emit({ type: "generation.started", jobId: job.id, kind: job.kind });
  }
  if (job.status === "running") {
    realtimeEventBus.emit({ type: "generation.progress", jobId: job.id, progress: job.progress });
  }
  if (job.status === "done") {
    realtimeEventBus.emit({ type: "generation.completed", jobId: job.id, result: job.result });
  }
  if (job.status === "error" && job.error) {
    realtimeEventBus.emit({ type: "generation.failed", jobId: job.id, error: job.error });
  }
}

/** Subscribe to AI generation job progress for the current user. */
export function useAiGenerationRealtime(userId: string | undefined | null): boolean {
  const queryClient = useQueryClient();

  const createChannel = useCallback(() => {
    const uid = userId!;
    return supabase
      .channel(`ai_generation_${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_generation_jobs",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const prev = parseJobRow({ old: payload.old as Partial<AiGenerationJobRow> });
          const job = parseJobRow({ new: payload.new as Partial<AiGenerationJobRow> });
          if (!job) return;
          patchJobCache(queryClient, uid, job);
          emitJobEvents(job, prev?.status);
        },
      );
  }, [userId, queryClient]);

  return useRealtimeChannel(userId ? `ai_generation_${userId}` : null, userId ? createChannel : null, {
    scope: "ai_generation",
    enabled: !!userId,
  });
}
