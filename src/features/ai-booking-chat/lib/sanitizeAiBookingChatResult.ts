import type { AiBookingChatResult } from "../model/types";

export function sanitizeAiBookingChatResult(
  result: AiBookingChatResult,
  orderedPlaceIds: string[],
): AiBookingChatResult {
  const allowed = new Set(orderedPlaceIds);
  const excludedPlaceIds = result.excludedPlaceIds.filter((id) => allowed.has(id));
  const excl = new Set(excludedPlaceIds);
  const visible = orderedPlaceIds.filter((id) => !excl.has(id));
  const headRaw = result.rerankedPlaceIds.filter((id) => allowed.has(id) && !excl.has(id));
  const seen = new Set<string>();
  const head = headRaw.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const tail = visible.filter((id) => !seen.has(id));
  return {
    ...result,
    rerankedPlaceIds: [...head, ...tail],
    excludedPlaceIds,
  };
}
