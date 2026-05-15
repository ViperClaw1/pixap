import { devLog } from "@/shared/lib/devLog";

let t0 = 0;

export function resetStartupTiming(): void {
  if (!__DEV__) return;
  t0 = performance.now();
}

export function markStartup(label: string): void {
  if (!__DEV__) return;
  if (!t0) t0 = performance.now();
  devLog(`[startup][+${(performance.now() - t0).toFixed(1)}ms] ${label}`);
}
