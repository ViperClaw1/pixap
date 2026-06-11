import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { deleteBusinessCardImageFromStorage, useRemoveBusinessCardImage } from "@/entities/business-card";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import { isUserOwnedBusinessCardImageUrl } from "@/shared/lib/business-card/userOwnedBusinessCardImage";

export function useDeleteVenuePhoto(venueId: string | undefined) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const removeImage = useRemoveBusinessCardImage();
  const [deleting, setDeleting] = useState(false);

  const canDeletePhoto = useCallback(
    (imageUrl: string) => isUserOwnedBusinessCardImageUrl(imageUrl, user?.id),
    [user?.id],
  );

  const deletePhoto = useCallback(
    async (imageUrl: string): Promise<boolean> => {
      if (!venueId || !user?.id || !canDeletePhoto(imageUrl)) return false;

      setDeleting(true);
      try {
        await removeImage.mutateAsync({ venueId, imageUrl });
        try {
          await deleteBusinessCardImageFromStorage(imageUrl, user.id);
        } catch {
          // Row already updated; orphaned storage objects are acceptable.
        }
        return true;
      } catch (error) {
        Alert.alert(
          t("placePhotoGrid.deleteFailedTitle"),
          formatErrorForAlert(error, t("placePhotoGrid.deleteFailedBody")),
        );
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [canDeletePhoto, removeImage, t, user?.id, venueId],
  );

  return {
    deletePhoto,
    deleting,
    canDeletePhoto,
  };
}
