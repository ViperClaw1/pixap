import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/app/providers/AuthProvider";
import { AVATAR_STORAGE_MAX_LONG_EDGE, prepareImageForStorageUpload } from "@/shared/lib/prepareImageForStorageUpload";
import { buildStorageUploadOptions } from "@/shared/lib/storageUploadOptions";
import { useUpdateProfile } from "./useProfile";

const AVATARS_BUCKET = "avatars";

export function useUploadProfileAvatar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  return useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      if (!user?.id) {
        throw new Error("Sign in required to upload an avatar.");
      }
      const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
        maxLongEdgePx: AVATAR_STORAGE_MAX_LONG_EDGE,
      });
      if (!bytes.byteLength) {
        throw new Error("Selected image is empty (0 bytes).");
      }

      const path = `${user.id}/${Date.now()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(
        path,
        bytes,
        buildStorageUploadOptions(contentType, "immutable"),
      );
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const avatarUrl = data.publicUrl;
      await updateProfile.mutateAsync({ avatar_url: avatarUrl });
      return avatarUrl;
    },
    onSuccess: () => {
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile.user(user.id) });
      }
    },
  });
}
