export type SupabaseRowWithId = { id: string };

export function parseSupabaseRowWithId(data: unknown): SupabaseRowWithId {
  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("Expected Supabase row with id");
  }
  const id = (data as { id: unknown }).id;
  if (typeof id === "string" && id.length > 0) return { id };
  if (typeof id === "number" && Number.isFinite(id)) return { id: String(id) };
  throw new Error("Expected Supabase row with string or numeric id");
}
