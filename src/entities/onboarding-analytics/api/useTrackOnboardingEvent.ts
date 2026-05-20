import { useCallback, useRef } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { supabase } from "@/shared/api/supabase/client";
import type { Json } from "@/shared/api/supabase/types";

export type OnboardingEventName =
  | "onboarding_started"
  | "step_completed"
  | "step_skipped"
  | "onboarding_abandoned"
  | "venue_rated"
  | "onboarding_completed";

type PendingEvent = {
  event_name: OnboardingEventName;
  step?: string;
  payload?: Record<string, unknown>;
};

const FLUSH_MS = 800;

export function useTrackOnboardingEvent() {
  const { user } = useAuth();
  const queueRef = useRef<PendingEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!user?.id || queueRef.current.length === 0) return;
    const batch = queueRef.current.splice(0, queueRef.current.length);
    const rows = batch.map((e) => ({
      user_id: user.id,
      event_name: e.event_name,
      step: e.step ?? null,
      payload: (e.payload ?? {}) as Json,
    }));
    await supabase.from("onboarding_events").insert(rows);
  }, [user?.id]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, FLUSH_MS);
  }, [flush]);

  const track = useCallback(
    (event: PendingEvent) => {
      if (!user?.id) return;
      queueRef.current.push(event);
      scheduleFlush();
    },
    [scheduleFlush, user?.id],
  );

  const trackImmediate = useCallback(
    async (event: PendingEvent) => {
      if (!user?.id) return;
      await supabase.from("onboarding_events").insert({
        user_id: user.id,
        event_name: event.event_name,
        step: event.step ?? null,
        payload: (event.payload ?? {}) as Json,
      });
    },
    [user?.id],
  );

  return { track, trackImmediate, flush };
}
