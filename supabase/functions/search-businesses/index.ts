import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Req = { query?: string; city?: string; limit?: number; preference_tags?: string[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as Req;
    const queryText = (body.query ?? "").trim().toLowerCase();
    const preferenceTags = (body.preference_tags ?? []).map((t) => t.toLowerCase());
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

    let qb = supabase.from("business_cards").select("id,name,address,city,rating,booking_price,tags");
    if (body.city?.trim()) qb = qb.eq("city", body.city.trim());
    const { data, error } = await qb.limit(Math.max(3, Math.min(body.limit ?? 8, 20)));
    if (error) throw error;

    const scored = (data ?? [])
      .map((p) => {
        const tags = (p.tags ?? []).map((t: string) => t.toLowerCase());
        const name = (p.name ?? "").toLowerCase();
        const address = (p.address ?? "").toLowerCase();
        const textScore =
          (queryText && (name.includes(queryText) || tags.some((t: string) => t.includes(queryText)) || address.includes(queryText))) ? 2 : 0;
        const prefScore = preferenceTags.filter((t) => tags.includes(t)).length;
        return { ...p, _score: Number(p.rating ?? 0) + textScore + prefScore };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, body.limit ?? 3)
      .map(({ _score, ...rest }) => rest);

    return new Response(JSON.stringify({ places: scored }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
