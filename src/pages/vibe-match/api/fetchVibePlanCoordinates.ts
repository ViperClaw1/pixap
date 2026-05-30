import { supabase } from "@/shared/api/supabase/client";

export type VibePlanCoordinate = {
  venueId: string;
  latitude: number;
  longitude: number;
};

function parseCoordinate(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isValidMapCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export async function fetchVibePlanCoordinates(venueIds: string[]): Promise<VibePlanCoordinate[]> {
  const uniqueIds = [...new Set(venueIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("business_cards")
    .select("id, latitude, longitude")
    .in("id", uniqueIds);

  if (error) throw error;

  const out: VibePlanCoordinate[] = [];
  for (const row of data ?? []) {
    const latitude = parseCoordinate(row.latitude);
    const longitude = parseCoordinate(row.longitude);
    if (latitude == null || longitude == null) continue;
    if (!isValidMapCoordinate(latitude, longitude)) continue;
    out.push({ venueId: String(row.id), latitude, longitude });
  }
  return out;
}
