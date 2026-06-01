import { useNavigationGuard } from "./useNavigationGuard";

const DEFAULT_RESET_MS = 500;

/** Prevents double navigation from rapid taps. */
export function useNavigateOnce(resetMs = DEFAULT_RESET_MS) {
  const { guardAction } = useNavigationGuard(resetMs);
  return guardAction;
}
