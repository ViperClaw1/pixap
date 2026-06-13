import * as Localization from "expo-localization";
import { supabase } from "@/shared/api/supabase/client";
import { devWarn } from "@/shared/lib/devLog";

/** Persists device IANA timezone for local daily recommendation cron slots. */
export async function syncProfileTimezone(): Promise<void> {
  const timezone = Localization.getCalendars()[0]?.timeZone ?? Localization.timezone;
  if (!timezone?.trim()) return;

  const { error } = await supabase.rpc("sync_profile_timezone", {
    p_timezone: timezone,
  });

  if (error) {
    devWarn("[profile] sync_profile_timezone failed", error.message);
  }
}
