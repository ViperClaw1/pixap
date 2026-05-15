import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/app/providers/AuthProvider";
import { STORY_STORAGE_MAX_LONG_EDGE, prepareImageForStorageUpload } from "@/shared/lib/prepareImageForStorageUpload";
import { encodeBlurHashFromPickerAssetUri } from "@/shared/lib/encodeMediaBlurHash";
import { formatErrorForAlert } from "@/shared/lib/formatErrorForAlert";
import type { StorySourceOption } from "@/shared/ui/story-source-picker/StorySourcePickerModal";
import { useCreateStory } from "./useCreateStory";

const STORIES_BUCKET = "stories";

export function useAddStoryMediaFlow(placeId: string | null) {
  const { user } = useAuth();
  const createStory = useCreateStory();
  const [uploadingStory, setUploadingStory] = useState(false);

  const uploadStoryPhotos = useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (!placeId) return;
      setUploadingStory(true);
      try {
        const startedAt = Date.now();
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        for (let i = 0; i < assets.length; i += 1) {
          const asset = assets[i];
          const blurHash = await encodeBlurHashFromPickerAssetUri(asset.uri);
          const { bytes, contentType, fileExtension } = await prepareImageForStorageUpload(asset, {
            maxLongEdgePx: STORY_STORAGE_MAX_LONG_EDGE,
          });
          if (!bytes.byteLength) {
            throw new Error("Selected image is empty. Please try another image.");
          }
          const path = `${user?.id ?? "anonymous"}/${startedAt}-${i}-${Math.random().toString(36).slice(2, 10)}.${fileExtension}`;
          const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, bytes, {
            upsert: true,
            contentType,
          });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
          await createStory.mutateAsync({
            placeId,
            content: "New story",
            mediaUrl: data.publicUrl,
            expiryTime,
            mediaBlurhashes: blurHash ? [blurHash] : null,
          });
        }
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
      selectionLimit: 15,
      base64: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      await uploadStoryPhotos(result.assets);
    }
  }, [uploadStoryPhotos]);

  const chooseStorySource = useCallback(
    (source: StorySourceOption) => {
      if (source === "camera") {
        void pickStoryFromCamera();
        return;
      }
      void pickStoryFromGallery();
    },
    [pickStoryFromCamera, pickStoryFromGallery],
  );

  return { uploadingStory, chooseStorySource };
}
