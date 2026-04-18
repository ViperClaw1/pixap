import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const PHONE_VALIDATION_PATTERN = /^\d-\(\d{3}\)-\d{3}-\d{4}$/;

const formatPhoneMask = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  let masked = digits[0];
  if (digits.length > 1) masked += "-(" + digits.slice(1, Math.min(4, digits.length));
  // Close the area-code parenthesis only when enough digits exist to avoid sticky backspace behavior.
  if (digits.length > 4) masked += ")-" + digits.slice(4, Math.min(7, digits.length));
  if (digits.length > 7) masked += "-" + digits.slice(7, 11);
  return masked;
};

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(formatPhoneMask(profile?.phone ?? ""));
  const [avatarUrl, setAvatarUrl] = useState<string>((user?.user_metadata?.avatar_url as string) ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhone(formatPhoneMask(profile.phone ?? ""));
  }, [profile]);

  useEffect(() => {
    setAvatarUrl((user?.user_metadata?.avatar_url as string) ?? "");
  }, [user]);

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhoneMask(value));
    setPhoneError(null);
  };

  const pickAvatar = () => {
    Alert.alert("Choose avatar", "Select where to pick your photo from.", [
      { text: "Cancel", style: "cancel" },
      { text: "Camera", onPress: () => void pickAvatarFromCamera() },
      { text: "Gallery", onPress: () => void pickAvatarFromGallery() },
    ]);
  };

  const pickAvatarFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const pickAvatarFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (localUri: string) => {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch {
      Alert.alert("Upload failed", "Could not upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    if (phone && !PHONE_VALIDATION_PATTERN.test(phone)) {
      setPhoneError("Phone must match X-(XXX)-XXX-XXXX");
      return;
    }
    const phoneToSave = phone.trim() ? phone.trim() : null;
    try {
      await update.mutateAsync({
        first_name: first.trim(),
        last_name: last.trim(),
        phone: phoneToSave,
      });
      if (avatarUrl) {
        const { error } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
        if (error) throw error;
      }
      Alert.alert("Saved");
      navigation.goBack();
    } catch {
      Alert.alert("Failed to save");
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Edit profile</Text>

      <View style={styles.avatarBlock}>
        {avatarUrl?.trim() ? (
          <SmartImage uri={avatarUrl} recyclingKey={avatarUrl} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{(first || "U").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Pressable style={styles.avatarBtn} onPress={pickAvatar} disabled={uploadingAvatar}>
          {uploadingAvatar ? <ActivityIndicator color="#fff" /> : <Text style={styles.avatarBtnText}>Upload avatar</Text>}
        </Pressable>
      </View>

      <Text style={styles.label}>First name</Text>
      <TextInput style={styles.input} value={first} onChangeText={setFirst} placeholderTextColor="#7987a0" />
      <Text style={styles.label}>Last name</Text>
      <TextInput style={styles.input} value={last} onChangeText={setLast} placeholderTextColor="#7987a0" />
      <Text style={styles.label}>Email</Text>
      <TextInput style={[styles.input, styles.disabledInput]} value={profile?.email ?? user?.email ?? ""} editable={false} />
      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={[styles.input, phoneError ? styles.inputError : null]}
        value={phone}
        onChangeText={handlePhoneChange}
        keyboardType="phone-pad"
        placeholder="X-(XXX)-XXX-XXXX"
        placeholderTextColor="#7987a0"
      />
      {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
      <Pressable style={styles.btn} onPress={() => void save()} disabled={update.isPending || uploadingAvatar}>
        <Text style={styles.btnText}>{update.isPending ? "Saving..." : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#07101d" },
  content: { padding: 16, paddingTop: 48, paddingBottom: 36 },
  title: { color: "#f4f7ff", fontSize: 22, fontWeight: "800", marginBottom: 16 },
  avatarBlock: { alignItems: "center", marginBottom: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#1a2538" },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#f0f4ff", fontSize: 28, fontWeight: "700" },
  avatarBtn: {
    marginTop: 10,
    backgroundColor: "#18243a",
    borderWidth: 1,
    borderColor: "#2b3954",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  avatarBtnText: { color: "#f0f4ff", fontWeight: "600", fontSize: 14 },
  label: { marginTop: 12, fontWeight: "600", color: "#d2dcef", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#26344d",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    fontSize: 14,
    color: "#f2f6ff",
    backgroundColor: "#111b2a",
  },
  disabledInput: { backgroundColor: "#1b2435", color: "#7c8aa2" },
  inputError: { borderColor: "#cc4b5f" },
  errorText: { color: "#dd6879", marginTop: 6, fontSize: 12 },
  btn: {
    marginTop: 24,
    backgroundColor: "#18243a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2b3954",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
