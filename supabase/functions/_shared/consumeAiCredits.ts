import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreditRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function consumeAiCredits(
  client: SupabaseClient,
  input: {
    userId: string;
    delta: number;
    requestId: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
  },
): Promise<CreditRpcResult> {
  const args = {
    p_user_id: input.userId,
    p_delta: -Math.abs(input.delta),
    p_input_tokens: input.inputTokens ?? null,
    p_output_tokens: input.outputTokens ?? null,
  };
  const current = await client.rpc("consume_ai_query_credit", {
    ...args,
    p_request_id: input.requestId,
  });

  if (
    current.error?.message.includes("Could not find the function") ||
    current.error?.message.includes("schema cache")
  ) {
    const legacy = await client.rpc("consume_ai_query_credit", args);
    return legacy as CreditRpcResult;
  }

  return current as CreditRpcResult;
}
