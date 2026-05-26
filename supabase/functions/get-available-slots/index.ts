import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type Req = { business_id: string; date?: string };

const BOOKING_SLOT_START_MINUTES = 9 * 60;
const BOOKING_SLOT_END_MINUTES = 23 * 60 + 30;
const BOOKING_SLOT_STEP_MINUTES = 30;
const BOOKING_MIN_LEAD_MS = 30 * 60_000;

function formatSlotLabel(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildSlotTimeLabels(): string[] {
  const labels: string[] = [];
  for (
    let totalMinutes = BOOKING_SLOT_START_MINUTES;
    totalMinutes <= BOOKING_SLOT_END_MINUTES;
    totalMinutes += BOOKING_SLOT_STEP_MINUTES
  ) {
    labels.push(formatSlotLabel(totalMinutes));
  }
  return labels;
}

function slotDateFromDayAndMinutes(day: Date, totalMinutes: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
  return d;
}

function snapIsoToSlotMs(iso: string): number {
  const t = new Date(iso).getTime();
  const stepMs = BOOKING_SLOT_STEP_MINUTES * 60_000;
  return Math.round(t / stepMs) * stepMs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as Req;
    const day = body.date ? new Date(body.date) : new Date();
    day.setHours(0, 0, 0, 0);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const db =
      serviceKey && serviceKey.length > 0
        ? createClient(url, serviceKey, { auth: { persistSession: false } })
        : userClient;

    const dayStart = new Date(day);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const { data: bookings, error } = await db
      .from("bookings")
      .select("date_time")
      .eq("business_card_id", body.business_id)
      .eq("payment_status", "paid")
      .gte("date_time", dayStart.toISOString())
      .lt("date_time", dayEnd.toISOString());
    if (error) throw error;

    const busy = new Set((bookings ?? []).map((b) => snapIsoToSlotMs(String(b.date_time))));
    const minStart = Date.now() + BOOKING_MIN_LEAD_MS;

    const slots = buildSlotTimeLabels().map((label) => {
      const [h, m] = label.split(":").map(Number);
      const dt = slotDateFromDayAndMinutes(day, h * 60 + m);
      const notBusy = !busy.has(dt.getTime());
      const pastLead = dt.getTime() < minStart;
      return {
        label,
        dateTimeIso: dt.toISOString(),
        available: notBusy && !pastLead,
        isBest: false,
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
