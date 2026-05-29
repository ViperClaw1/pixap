import { useEffect, useState } from "react";
import {
  isPostBoostBadgeVisible,
  POST_BOOST_BADGE_VISIBILITY_MS,
} from "../lib/postBoostCooldown";

export function usePostBoostBadgeVisible(boostedAt: string | null | undefined): boolean {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    if (!boostedAt) return;

    const boostedMs = new Date(boostedAt).getTime();
    if (!Number.isFinite(boostedMs)) return;

    const remaining = boostedMs + POST_BOOST_BADGE_VISIBILITY_MS - Date.now();
    if (remaining <= 0) return;

    const timer = setTimeout(() => setNowMs(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [boostedAt]);

  return isPostBoostBadgeVisible(boostedAt, nowMs);
}
