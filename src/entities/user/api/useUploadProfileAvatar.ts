import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { uploadProfileAvatarAsset } from "@/entities/user/lib/uploadProfileAvatar";
import type { Profile } from "./useProfile";
import { useUpdateProfile } from "./useProfile";

function isMissingAvatarBlurhashColumn(message: string): boolean {
  return message.toLowerCase().includes("avatar_blurhash");
}

export function useUploadProfileAvatar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  return useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      if (!user?.id) {
        throw new Error("Sign in required to upload an avatar.");
      }

      const { avatarUrl, blurhash } = await uploadProfileAvatarAsset(user.id, asset);

      const updates: Partial<Profile> = { avatar_url: avatarUrl };
      if (blurhash) updates.avatar_blurhash = blurhash;

      try {
        await updateProfile.mutateAsync(updates);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (blurhash && isMissingAvatarBlurhashColumn(msg)) {
          await updateProfile.mutateAsync({ avatar_url: avatarUrl });
        } else {
          throw err;
        }
      }

      return { avatarUrl, blurhash };
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile.user(user.id) });
      }
    },
  });
}
