import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/shared/api/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { bytesFromBase64 } from "@/shared/lib/bytesFromBase64";
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
        const uploadedUrls: string[] = [];
        const startedAt = Date.now();
        for (let i = 0; i < assets.length; i += 1) {
          const asset = assets[i];
          let fileBytes: ArrayBuffer | Uint8Array;
          if (asset.base64) {
            fileBytes = bytesFromBase64(asset.base64);
          } else {
            const response = await fetch(asset.uri);
            if (!response.ok) throw new Error(`Failed to read selected image (${response.status})`);
            fileBytes = await response.arrayBuffer();
          }
          const mimeType = asset.mimeType || "image/jpeg";
          const ext = asset.fileName?.split(".").pop()?.toLowerCase() ?? (mimeType === "image/png" ? "png" : "jpg");
          const path = `${user?.id ?? "anonymous"}/${startedAt}-${i}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, fileBytes, {
            upsert: true,
            contentType: mimeType,
          });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
          uploadedUrls.push(data.publicUrl);
        }
        if (!uploadedUrls.length) return;
        const expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        for (const publicUrl of uploadedUrls) {
          await createStory.mutateAsync({
            placeId,
            content: "New story",
            mediaUrl: publicUrl,
            expiryTime,
          });
        }
      } catch (error) {
        Alert.alert("Story failed", error instanceof Error ? error.message : "Could not upload story.");
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
      base64: true,
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
