import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

/** Returns false when another profile already uses this username (case-insensitive). */
export async function isUsernameAvailable(username: string, userId: string): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!normalized) return false;

  const { data, error } = await supabase
    .from("public_profiles" as any)
    .select("id")
    .ilike("username", normalized)
    .neq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

/** Peer phone for share flows; uses RPC because `profiles` RLS is select-own only. */
export async function fetchProfilePhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_profile_phone_for_share" as never, {
    p_user_id: userId,
  } as never);
  if (error) throw error;
  if (typeof data !== "string") return null;
  const trimmed = data.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function markProfileVerified(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_verified: true })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export async function markProfileVerifiedAndInvalidate(
  queryClient: QueryClient,
  userId: string,
): Promise<boolean> {
  const ok = await markProfileVerified(userId);
  if (!ok) return false;
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile.user(userId) });
  await queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
  return true;
}
