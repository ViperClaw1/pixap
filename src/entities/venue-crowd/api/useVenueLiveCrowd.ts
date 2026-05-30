import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { parseVenueLiveCrowd } from "../lib/parseVenueLiveCrowd";

const CROWD_POLL_MS = 60_000;
const CROWD_STALE_MS = 30_000;

export function useVenueLiveCrowd(venueId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.venueCrowd.byVenue(venueId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_venue_live_crowd", {
        p_venue_id: venueId,
      });
      if (error) throw error;
      return parseVenueLiveCrowd(data);
    },
    enabled: Boolean(venueId) && (options?.enabled ?? true),
    refetchInterval: CROWD_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: CROWD_STALE_MS,
  });
}
