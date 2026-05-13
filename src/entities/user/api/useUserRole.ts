import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export const useUserRole = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.userRole.byUser(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return (data?.role as string) ?? "buyer";
    },
    enabled: !!user,
  });

  return {
    ...query,
    role: query.data ?? null,
    isAdmin: query.data === "admin",
  };
};
