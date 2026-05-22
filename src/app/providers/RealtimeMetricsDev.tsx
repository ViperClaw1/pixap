import { useRealtimeMetricsDev } from "@/shared/lib/useRealtimeMetricsDev";

/** Dev-only realtime reconnect / channel error counters. */
export function RealtimeMetricsDev() {
  useRealtimeMetricsDev();
  return null;
}
