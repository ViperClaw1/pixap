export type PixaiBookingChatShape = {
  message: string;
  filters: Record<string, unknown>;
  rerankedPlaceIds: string[];
  excludedPlaceIds: string[];
  explanation?: string;
};

type PlaceIdSource = { id: string };

export function validatePixaiBookingChatShape(
  raw: unknown,
  places: PlaceIdSource[],
): PixaiBookingChatShape {
  const orderedIds = places.map((p) => String(p.id));
  const allowedIds = new Set(orderedIds);
  const base: PixaiBookingChatShape = {
    message: "Here are places from your current results, re-ordered for what you asked.",
    filters: {},
    rerankedPlaceIds: [...orderedIds],
    excludedPlaceIds: [],
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const message = typeof o.message === "string" && o.message.trim() ? o.message.trim() : base.message;
  const filters =
    o.filters != null && typeof o.filters === "object" && !Array.isArray(o.filters)
      ? (o.filters as Record<string, unknown>)
      : {};
  const rerankRaw = Array.isArray(o.rerankedPlaceIds) ? o.rerankedPlaceIds : [];
  const exclRaw = Array.isArray(o.excludedPlaceIds) ? o.excludedPlaceIds : [];
  const excludedPlaceIds = exclRaw
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((id) => allowedIds.has(id));
  const exclSet = new Set(excludedPlaceIds);
  const visibleOrdered = orderedIds.filter((id) => !exclSet.has(id));

  const headCandidates = rerankRaw
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((id) => allowedIds.has(id) && !exclSet.has(id));
  const seen = new Set<string>();
  const head = headCandidates.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const tail = visibleOrdered.filter((id) => !seen.has(id));
  const rerankedPlaceIds = [...head, ...tail];
  const explanation = typeof o.explanation === "string" ? o.explanation : undefined;
  return { message, filters, rerankedPlaceIds, excludedPlaceIds, explanation };
}
