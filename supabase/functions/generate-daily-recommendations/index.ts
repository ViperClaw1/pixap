import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isServiceAuthorized, resolveSupabaseSecretKey } from "../_shared/serviceAuth.ts";

type BatchRow = {
  user_id: string;
  inserted_count: number;
  push_enqueued: boolean;
};

function asUtcDate(input?: string): string {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = resolveSupabaseSecretKey();
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!isServiceAuthorized(req, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { date?: string; force?: boolean; batch_size?: number };
  try {
    body = (await req.json()) as { date?: string; force?: boolean; batch_size?: number };
  } catch {
    body = {};
  }

  const targetDate = asUtcDate(body.date);
  const force = Boolean(body.force);
  const batchSize = Math.max(1, Math.min(Number(body.batch_size) || 100, 500));

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: runRow, error: runInsertError } = await admin
    .from("recommendation_generation_runs")
    .insert({
      generated_for_date: targetDate,
      status: "running",
      started_at: new Date().toISOString(),
      users_processed: 0,
    })
    .select("id")
    .single();

  if (runInsertError || !runRow?.id) {
    return new Response(JSON.stringify({ error: runInsertError?.message ?? "run_start_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runId = runRow.id as string;
  let cursor: string | null = null;
  let usersProcessed = 0;
  let recsGenerated = 0;
  let pushesQueued = 0;

  try {
    for (;;) {
      const { data, error } = await admin.rpc("run_daily_recommendation_batch", {
        p_run_id: runId,
        p_date: targetDate,
        p_batch_size: batchSize,
        p_after_user_id: cursor,
      });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as BatchRow[];
      if (rows.length === 0) break;

      usersProcessed += rows.length;
      recsGenerated += rows.reduce((acc, row) => acc + Math.max(0, Number(row.inserted_count) || 0), 0);
      pushesQueued += rows.reduce((acc, row) => acc + (row.push_enqueued ? 1 : 0), 0);

      cursor = rows[rows.length - 1]?.user_id ?? null;
      if (!cursor) break;
      if (rows.length < batchSize) break;
    }

    await admin
      .from("recommendation_generation_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        users_processed: usersProcessed,
        error_log: null,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        generated_for_date: targetDate,
        users_processed: usersProcessed,
        recommendations_generated: recsGenerated,
        pushes_queued: pushesQueued,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await admin
      .from("recommendation_generation_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        users_processed: usersProcessed,
        error_log: message,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        ok: false,
        run_id: runId,
        generated_for_date: targetDate,
        users_processed: usersProcessed,
        error: message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
