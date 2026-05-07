import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";

type CreateNotificationInput = {
  text: string;
  businessCardId?: string | null;
};

export const useCreateNotification = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, businessCardId }: CreateNotificationInput) => {
      if (!user?.id) throw new Error("Authentication required");
      const payload = {
        user_id: user.id,
        text: text.trim(),
        business_card_id: businessCardId ?? null,
      };
      const { error } = await supabase.from("notifications").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};
