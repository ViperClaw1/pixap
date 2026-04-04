import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Req = { business_id: string; date?: string };

function toIso(date: Date, hour: number) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as Req;
    const day = body.date ? new Date(body.date) : new Date();
    day.setHours(0, 0, 0, 0);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );

    const hours = [10, 11, 12, 13, 14, 16, 17, 18];
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("date_time")
      .eq("business_card_id", body.business_id)
      .gte("date_time", toIso(day, 0))
      .lt("date_time", toIso(day, 23));
    if (error) throw error;

    const busy = new Set((bookings ?? []).map((b) => new Date(b.date_time).getHours()));
    const slots = hours.map((hour, idx) => {
      const dateTimeIso = toIso(day, hour);
      return {
        label: `${String(hour).padStart(2, "0")}:00`,
        dateTimeIso,
        available: !busy.has(hour),
        isBest: idx === 1 && !busy.has(hour),
      };
    });

    return new Response(JSON.stringify({ slots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
