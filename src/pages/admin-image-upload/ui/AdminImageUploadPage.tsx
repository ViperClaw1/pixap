import { AppPressable } from "@/shared/ui/app-pressable";
import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/app/providers/AuthProvider";
import { uploadBusinessCardImage } from "@/entities/business-card";
import { useUserRole } from "@/entities/user";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getFeedPostCarouselImageUrl } from "@/shared/lib/feedMediaUrls";

/**
 * Partner/admin: pick an image and upload to `business-cards` (WebP, resized like posts).
 */
export default function AdminImageUploadScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isAdmin, role } = useUserRole();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  if (role !== "admin" && role !== "partner") {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Not available</Text>
        <Text style={styles.body}>This screen is for partners and admins.</Text>
        <AppPressable style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </AppPressable>
      </View>
    );
  }

  const explainAndPick = () => {
    Alert.alert(
      "Photo library",
      "We use your selected photo only to upload business listing images. You can change this in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: () => void pickImage() },
      ],
    );
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Photo library access was denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalUri(result.assets[0].uri);
      setPublicUrl(null);
    }
  };

  const upload = async () => {
    if (!localUri || !user?.id) return;
    setUploading(true);
    try {
      const asset = { uri: localUri, width: 0, height: 0 } as ImagePicker.ImagePickerAsset;
      const url = await uploadBusinessCardImage(asset, user.id);
      setPublicUrl(url);
      Alert.alert("Uploaded", "Image is in business-cards storage. Copy the URL from support tools if needed.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      Alert.alert("Upload failed", msg);
    } finally {
      setUploading(false);
    }
  };

  const previewUri = publicUrl
    ? getFeedPostCarouselImageUrl(publicUrl) || publicUrl
    : localUri;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Upload venue image</Text>
      <Text style={styles.body}>
        Images are stored as WebP (max 1600px) in the business-cards bucket with long CDN cache. Assign the
        returned URL to a business_cards.images entry in admin tools.
      </Text>
      <AppPressable style={styles.btn} onPress={explainAndPick} disabled={uploading}>
        <Text style={styles.btnText}>Choose photo</Text>
      </AppPressable>
      {previewUri ? (
        <SmartImage uri={previewUri} fallbackUri={publicUrl ?? localUri} style={styles.preview} contentFit="cover" />
      ) : null}
      {localUri && !publicUrl ? (
        <AppPressable
          style={[styles.btn, styles.btnPrimary, uploading && styles.btnDisabled]}
          onPress={() => void upload()}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Upload to storage</Text>
          )}
        </AppPressable>
      ) : null}
      {publicUrl ? (
        <Text style={styles.url} selectable>
          {publicUrl}
        </Text>
      ) : null}
      {isAdmin ? <Text style={styles.hint}>Signed in as admin.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  body: { color: "#555", lineHeight: 20, marginBottom: 16 },
  btn: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  btnPrimary: { marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "700" },
  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#eee" },
  url: { fontSize: 11, color: "#333", marginTop: 12 },
  hint: { marginTop: 12, fontSize: 12, color: "#888" },
});
