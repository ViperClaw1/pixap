import { supabase } from "@/shared/api/supabase/client";
import type { Json } from "@/shared/api/supabase/types";
import type { AiGenerationJob, AiGenerationJobStatus } from "../api/useAiGenerationJob";

export type CreateAiGenerationJobInput = {
  kind: string;
  status?: AiGenerationJobStatus;
  progress?: number;
};

/** Insert a job row for the current user (call before long-running Edge work). */
export async function createAiGenerationJob(input: CreateAiGenerationJobInput): Promise<AiGenerationJob> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .insert({
      user_id: user.id,
      kind: input.kind,
      status: input.status ?? "pending",
      progress: input.progress ?? 0,
    })
    .select("id, user_id, kind, status, progress, result, error, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as AiGenerationJob;
}

/** Update job progress/status (usable from client after edge returns job id). */
export async function updateAiGenerationJob(
  jobId: string,
  patch: Partial<Pick<AiGenerationJob, "status" | "progress" | "result" | "error">>,
): Promise<void> {
  const { error } = await supabase
    .from("ai_generation_jobs")
    .update({
      status: patch.status,
      progress: patch.progress,
      result: patch.result as Json | null | undefined,
      error: patch.error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw error;
}
