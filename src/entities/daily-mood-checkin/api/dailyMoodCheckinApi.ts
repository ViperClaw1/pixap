import { supabase } from "@/shared/api/supabase/client";
import type { DailyMoodCheckin, DailyMoodCheckinInput } from "../model/types";

const DAILY_MOOD_CHECKINS_TABLE = "daily_mood_checkins" as never;
const UPSERT_MY_DAILY_MOOD_CHECKIN_RPC = "upsert_my_daily_mood_checkin" as never;

type RawDailyMoodCheckin = Omit<DailyMoodCheckin, "mood_tags"> & {
  mood_tags: string[] | null;
};

function normalizeDailyMoodCheckin(row: RawDailyMoodCheckin): DailyMoodCheckin {
  return {
    ...row,
    mood_tags: (row.mood_tags ?? []) as DailyMoodCheckin["mood_tags"],
  };
}

export async function getMyDailyMoodCheckin(dateYmd: string): Promise<DailyMoodCheckin | null> {
  const { data, error } = await supabase
    .from(DAILY_MOOD_CHECKINS_TABLE)
    .select("id, user_id, checkin_date, mood_tags, energy_level, detail_note, skipped, created_at, updated_at" as never)
    .eq("checkin_date" as never, dateYmd as never)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeDailyMoodCheckin(data as unknown as RawDailyMoodCheckin);
}

export async function upsertMyDailyMoodCheckin(input: DailyMoodCheckinInput): Promise<DailyMoodCheckin> {
  const { data, error } = await supabase.rpc(UPSERT_MY_DAILY_MOOD_CHECKIN_RPC, {
    p_date: input.dateYmd,
    p_mood_tags: input.moodTags,
    p_energy_level: input.energyLevel,
    p_detail_note: input.detailNote ?? null,
    p_skipped: false,
  } as never);

  if (error) throw error;
  return normalizeDailyMoodCheckin(data as unknown as RawDailyMoodCheckin);
}

export async function skipMyDailyMoodCheckin(dateYmd: string): Promise<DailyMoodCheckin> {
  const { data, error } = await supabase.rpc(UPSERT_MY_DAILY_MOOD_CHECKIN_RPC, {
    p_date: dateYmd,
    p_mood_tags: [],
    p_energy_level: null,
    p_detail_note: null,
    p_skipped: true,
  } as never);

  if (error) throw error;
  return normalizeDailyMoodCheckin(data as unknown as RawDailyMoodCheckin);
}
