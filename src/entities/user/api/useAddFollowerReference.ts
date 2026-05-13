import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";

export function useAddFollowerReference() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetProfileId: string) => {
      if (!user?.id) throw new Error("Authentication required");
      if (!targetProfileId) throw new Error("Profile is required");
      if (targetProfileId === user.id) throw new Error("Cannot follow yourself");

      const { data: currentProfile, error: currentProfileError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- followers column is introduced by migration
        .from("profiles" as any)
        .select("followers")
        .eq("id", user.id)
        .single();
      if (currentProfileError) throw currentProfileError;

      const followers = Array.isArray((currentProfile as { followers?: unknown }).followers)
        ? ((currentProfile as { followers: unknown[] }).followers as string[])
        : [];

      if (followers.includes(targetProfileId)) {
        return { alreadyAdded: true as const };
      }

      const { error: updateError } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- followers column is introduced by migration
        .from("profiles" as any)
        .update({ followers: [...followers, targetProfileId] })
        .eq("id", user.id);
      if (updateError) throw updateError;

      return { alreadyAdded: false as const };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicProfiles.root });
    },
  });
}
