import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { uploadBusinessCardImage, useAppendBusinessCardImage } from "@/entities/business-card";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";

export function useUploadVenuePhoto(venueId: string | undefined) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const appendImage = useAppendBusinessCardImage();
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = useCallback(async (): Promise<string | null> => {
    if (!venueId || !user?.id) return null;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("placePhotoGrid.permissionTitle"), t("placePhotoGrid.permissionBody"));
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      base64: false,
    });

    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;

    setUploading(true);
    try {
      const imageUrl = await uploadBusinessCardImage(asset, user.id);
      await appendImage.mutateAsync({ venueId, imageUrl });
      return imageUrl;
    } catch (error) {
      Alert.alert(
        t("placePhotoGrid.uploadFailedTitle"),
        formatErrorForAlert(error, t("placePhotoGrid.uploadFailedBody")),
      );
      return null;
    } finally {
      setUploading(false);
    }
  }, [appendImage, t, user?.id, venueId]);

  return {
    pickAndUpload,
    uploading,
    canUpload: Boolean(venueId && user?.id),
  };
}
