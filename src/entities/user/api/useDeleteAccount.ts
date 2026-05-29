import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import { clearSessionCaches } from "@/shared/lib/clearSessionCaches";

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  return useMutation({
    mutationFn: async (confirmation: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("delete-account", {
        body: { confirmation: confirmation.trim() },
      });
      if (error) throw error;
      if (data && typeof data === "object" && "error" in data && data.error) {
        throw new Error(String(data.error));
      }
    },
    onSuccess: async () => {
      await clearSessionCaches(queryClient);
      try {
        await signOut();
      } catch {
        await supabase.auth.signOut({ scope: "local" });
      }
    },
  });
}
