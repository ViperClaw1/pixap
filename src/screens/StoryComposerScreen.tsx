import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { SmartImage } from "@/components/SmartImage";
import { useAppTheme } from "@/contexts/ThemeContext";
import type { BrowseFlowParamList } from "@/navigation/types";
import { useCreateStory } from "@/hooks/useCreateStory";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/theme/primaryPressable";

type ComposerRoute = RouteProp<BrowseFlowParamList, "StoryComposer">;
type ComposerNav = NativeStackNavigationProp<BrowseFlowParamList, "StoryComposer">;
const STORIES_BUCKET = "stories";

function bytesFromBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function StoryComposerScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<ComposerNav>();
  const { params } = useRoute<ComposerRoute>();
  const { user } = useAuth();
  const createStory = useCreateStory();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const uploadStoryPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.id) {
      navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
      return;
    }
    setUploadingPhoto(true);
    try {
      let fileBytes: ArrayBuffer | Uint8Array;
      if (asset.base64) {
        fileBytes = bytesFromBase64(asset.base64);
      } else {
        const response = await fetch(asset.uri);
        if (!response.ok) {
          throw new Error(`Failed to read selected image (${response.status})`);
        }
        fileBytes = await response.arrayBuffer();
      }
      if (!fileBytes.byteLength) {
        throw new Error("Selected image is empty. Please try another image.");
      }
      const mimeType = asset.mimeType || "image/jpeg";
      const ext = asset.fileName?.split(".").pop()?.toLowerCase() ?? (mimeType === "image/png" ? "png" : "jpg");
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(STORIES_BUCKET).upload(path, fileBytes, {
        upsert: true,
        contentType: mimeType,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(STORIES_BUCKET).getPublicUrl(path);
      setMediaUrl(data.publicUrl);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
        return;
      }
      const message = error instanceof Error ? error.message : "Could not upload story photo.";
      Alert.alert("Upload failed", message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickFromCamera = async () => {
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
    if (asset?.uri) {
      await uploadStoryPhoto(asset);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: true,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset?.uri) {
      await uploadStoryPhoto(asset);
    }
  };

  const pickPhoto = () => {
    Alert.alert("Add photo", "Choose where to pick your story photo from.", [
      { text: "Cancel", style: "cancel" },
      { text: "Camera", onPress: () => void pickFromCamera() },
      { text: "Gallery", onPress: () => void pickFromGallery() },
    ]);
  };

  const onSubmit = async () => {
    try {
      await createStory.mutateAsync({
        placeId: params.placeId,
        content,
        mediaUrl,
      });
      navigation.goBack();
    } catch (error) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation as unknown as NavigationProp<ParamListBase>);
        return;
      }
      Alert.alert("Failed", error instanceof Error ? error.message : "Could not create story");
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            style={styles.root}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
              </Pressable>
              <Text style={[styles.title, { color: colors.text }]}>Add Story</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.content}>
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder="Share your experience..."
                placeholderTextColor={colors.textMuted}
                multiline
                style={[
                  styles.textArea,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <View
                style={[
                  styles.photoCard,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                {mediaUrl ? (
                  <SmartImage
                    uri={mediaUrl}
                    recyclingKey={mediaUrl}
                    style={styles.photoPreview}
                    contentFit="cover"
                    transition={180}
                  />
                ) : (
                  <View style={[styles.photoEmpty, { backgroundColor: colors.background }]}>
                    <Text style={[styles.photoEmptyText, { color: colors.textMuted }]}>Add a photo to make your story stand out</Text>
                  </View>
                )}
                <View style={styles.photoActions}>
                  <Pressable
                    style={[
                      styles.photoBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity: uploadingPhoto ? 0.7 : 1,
                      },
                    ]}
                    onPress={() => void pickPhoto()}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={[styles.photoBtnText, { color: colors.text }]}>
                        {mediaUrl ? "Change photo" : "Upload photo"}
                      </Text>
                    )}
                  </Pressable>
                  {mediaUrl ? (
                    <Pressable
                      style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                      onPress={() => setMediaUrl("")}
                      disabled={uploadingPhoto}
                    >
                      <Text style={[styles.photoBtnText, { color: colors.textMuted }]}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={[
                  styles.submitBtn,
                  {
                    opacity: createStory.isPending || uploadingPhoto ? 0.6 : 1,
                  },
                ]}
                onPress={() => void onSubmit()}
                disabled={createStory.isPending || uploadingPhoto}
              >
                <Text style={styles.submitText}>
                  {createStory.isPending ? "Posting..." : "Post story"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backText: {
    fontSize: 15,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  textArea: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 15,
  },
  photoCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  photoPreview: {
    width: "100%",
    height: 190,
    borderRadius: 10,
  },
  photoEmpty: {
    width: "100%",
    height: 130,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  photoEmptyText: {
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  photoActions: {
    flexDirection: "row",
    gap: 8,
  },
  photoBtn: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitBtn: {
    ...primaryPressableStyle,
  },
  submitText: primaryPressableTextStyle,
});
