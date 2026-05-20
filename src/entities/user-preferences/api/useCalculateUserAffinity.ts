import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";

export function useCalculateUserAffinity() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("calculate_user_affinity", {});
      if (error) throw error;
      return data;
    },
  });
}
