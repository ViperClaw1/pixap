import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";

export const useUserRole = (options?: { enabled?: boolean }) => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.userRole.byUser(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return (data?.role as string) ?? "buyer";
    },
    enabled: !!user && (options?.enabled ?? true),
    staleTime: Infinity,
  });

  return {
    ...query,
    role: query.data ?? null,
    isAdmin: query.data === "admin",
  };
};
