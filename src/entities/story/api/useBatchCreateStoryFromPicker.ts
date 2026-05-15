import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/app/providers/AuthProvider";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import type { StorySourceOption } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { defaultStoryPathBuilder, uploadStoryPickerAssets } from "../lib/uploadStoriesBucketMedia";
import { useCreateStory } from "./useCreateStory";

export function useBatchCreateStoryFromPicker(placeId: string | null) {
  const { user } = useAuth();
  const createStory = useCreateStory();
  const [uploadingStory, setUploadingStory] = useState(false);

  const uploadStoryPhotos = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (!placeId) return;
      setUploadingStory(true);
      try {
        const blurHashes: (string | null)[] = [];
        for (const asset of assets) {
          blurHashes.push(await encodeBlurHashFromPickerAssetUri(asset.uri));
        }
        const uploadedUrls = await uploadStoryPickerAssets(assets, user?.id, defaultStoryPathBuilder);
        if (!uploadedUrls.length) return;
        await createStory.mutateAsync({
          placeId,
          content: "New story",
          mediaUrl: JSON.stringify(uploadedUrls),
          expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          mediaBlurhashes: blurHashes.some((h) => h) ? blurHashes : null,
        });
      } catch (error) {
        Alert.alert("Story failed", formatErrorForAlert(error, "Could not upload story."));
      } finally {
        setUploadingStory(false);
      }
    },
    [createStory, placeId, user?.id],
  );

  const pickStoryFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      base64: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.uri) await uploadStoryPhotos([asset]);
  }, [uploadStoryPhotos]);

  const pickStoryFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 20,
      base64: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadStoryPhotos(result.assets);
    }
  }, [uploadStoryPhotos]);

  const onChooseStorySource = useCallback(
    (source: StorySourceOption) => {
      if (source === "camera") {
        void pickStoryFromCamera();
        return;
      }
      void pickStoryFromGallery();
    },
    [pickStoryFromCamera, pickStoryFromGallery],
  );

  return { uploadingStory, onChooseStorySource, hasPlace: Boolean(placeId) };
}
