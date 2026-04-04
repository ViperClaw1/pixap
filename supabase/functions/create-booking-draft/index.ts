import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Req = {
  business_card_id: string;
  date_time: string;
  cost: number;
  persons: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  comment?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = (await req.json()) as Req;
    if (!body.business_card_id || !body.date_time || !body.customer_name || !body.customer_phone || !body.customer_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw userErr ?? new Error("Unauthorized");

    const { data, error } = await supabase
      .from("cart_items")
      .insert({
        business_card_id: body.business_card_id,
        date_time: body.date_time,
        cost: body.cost,
        persons: body.persons,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone,
        customer_email: body.customer_email,
        comment: body.comment ?? null,
        status: "created",
        user_id: userData.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ draft: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
