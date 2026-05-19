import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/app/providers/AuthProvider";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import type { StorySourceOption } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { defaultStoryPathBuilder, uploadStoryPickerAssets } from "../lib/uploadStoriesBucketMedia";
import { useCreateStory } from "./useCreateStory";

export type StoryUploadStage = "idle" | "uploading_photos" | "creating_story";

export function useBatchCreateStoryFromPicker(placeId: string | null) {
  const { user } = useAuth();
  const createStory = useCreateStory();
  const [uploadStage, setUploadStage] = useState<StoryUploadStage>("idle");

  const uploadStoryPhotos = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]): Promise<string | null> => {
      if (!placeId) return null;
      setUploadStage("uploading_photos");
      try {
        const blurHashes: (string | null)[] = [];
        for (const asset of assets) {
          blurHashes.push(await encodeBlurHashFromPickerAssetUri(asset.uri));
        }
        const uploadedUrls = await uploadStoryPickerAssets(assets, user?.id, defaultStoryPathBuilder);
        if (!uploadedUrls.length) return null;

        setUploadStage("creating_story");
        const created = await createStory.mutateAsync({
          placeId,
          content: "New story",
          mediaUrl: JSON.stringify(uploadedUrls),
          expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          mediaBlurhashes: blurHashes.some((h) => h) ? blurHashes : null,
        });
        return String(created.id ?? "").trim() || null;
      } catch (error) {
        Alert.alert("Story failed", formatErrorForAlert(error, "Could not upload story."));
        return null;
      } finally {
        setUploadStage("idle");
      }
    },
    [createStory, placeId, user?.id],
  );

  const pickStoryFromCamera = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      base64: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.uri) return uploadStoryPhotos([asset]);
    return null;
  }, [uploadStoryPhotos]);

  const pickStoryFromGallery = useCallback(async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return null;
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
      return uploadStoryPhotos(result.assets);
    }
    return null;
  }, [uploadStoryPhotos]);

  const onChooseStorySource = useCallback(
    async (source: StorySourceOption): Promise<string | null> => {
      if (source === "camera") {
        return pickStoryFromCamera();
      }
      return pickStoryFromGallery();
    },
    [pickStoryFromCamera, pickStoryFromGallery],
  );

  return {
    uploadStage,
    uploadingStory: uploadStage !== "idle",
    onChooseStorySource,
    hasPlace: Boolean(placeId),
  };
}
