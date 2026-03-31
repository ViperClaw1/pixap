import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Image as RNImage, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Partner/admin-only: pick an image after an in-app explanation (store-friendly).
 * Upload to Supabase storage should mirror web `ImageUploader` (bucket `business-cards`).
 */
export default function AdminImageUploadScreen() {
  const navigation = useNavigation();
  const { isAdmin, role } = useUserRole();
  const [uri, setUri] = useState<string | null>(null);

  if (role !== "admin" && role !== "partner") {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Not available</Text>
        <Text style={styles.body}>This screen is for partners and admins.</Text>
        <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const explainAndPick = () => {
    Alert.alert(
      "Photo library",
      "We use your selected photo only to upload business listing images. You can change this in Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => void pickImage(),
        },
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
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.title}>Upload image (partner)</Text>
      <Text style={styles.body}>
        This flow requests photo access only when you tap the button below. Wire the selected file to
        `supabase.storage.from("business-cards").upload(...)` like the web admin uploader.
      </Text>
      <Pressable style={styles.btn} onPress={explainAndPick}>
        <Text style={styles.btnText}>Choose photo</Text>
      </Pressable>
      {uri ? <RNImage source={{ uri }} style={styles.preview} resizeMode="cover" /> : null}
      {isAdmin ? <Text style={styles.hint}>Signed in as admin.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, paddingTop: 56, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 8 },
  body: { color: "#555", lineHeight: 20, marginBottom: 16 },
  btn: { backgroundColor: "#111", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  btnText: { color: "#fff", fontWeight: "700" },
  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#eee" },
  hint: { marginTop: 12, fontSize: 12, color: "#888" },
});
