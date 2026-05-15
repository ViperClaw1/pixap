import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export async function fetchProfilePhone(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("profiles").select("phone").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.phone ?? null;
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
