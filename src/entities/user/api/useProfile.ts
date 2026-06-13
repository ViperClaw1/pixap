import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { toProfileUpdateError } from "../lib/profileUpdateErrors";

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  avatar_blurhash?: string | null;
  username: string | null;
  bio: string | null;
  followers: string[] | null;
  phone: string | null;
  city: string | null;
  timezone: string | null;
  is_verified: boolean;
  account_role: "user" | "admin";
  terms_accepted_at?: string | null;
  ai_data_consent_at?: string | null;
  ai_data_consent_declined_at?: string | null;
  promo_codes: string[] | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = (options?: { enabled?: boolean }) => {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile.user(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user && !loading && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateProfile = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user!.id)
        .select()
        .single();
      if (error) throw toProfileUpdateError(error);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.root }),
  });
};
