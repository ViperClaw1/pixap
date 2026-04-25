import { useMemo, useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SmartImage } from "@/components/SmartImage";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/theme/primaryPressable";

const PHONE_VALIDATION_PATTERN = /^\d-\(\d{3}\)-\d{3}-\d{4}$/;
const AVATARS_BUCKET = "avatars";

function bytesFromBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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

function EditProfileScreenContent() {
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(formatPhoneMask(profile?.phone ?? ""));
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhone(formatPhoneMask(profile.phone ?? ""));
    setAvatarUrl(profile.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  }, [profile, user]);

  useEffect(() => {
    if (!profile?.avatar_url) {
      setAvatarUrl((user?.user_metadata?.avatar_url as string) ?? "");
    }
  }, [profile?.avatar_url, user]);

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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0]);
    }
  };

  const pickAvatarFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Storage access is required to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await uploadAvatar(result.assets[0]);
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.id) return;
    setUploadingAvatar(true);
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
        throw new Error("Selected image is empty (0 bytes).");
      }

      const mimeType = asset.mimeType || "image/jpeg";
      const ext = asset.fileName?.split(".").pop()?.toLowerCase() ?? (mimeType === "image/png" ? "png" : "jpg");
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, fileBytes, {
        upsert: true,
        contentType: mimeType,
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      const nextAvatarUrl = data.publicUrl;
      setAvatarUrl(nextAvatarUrl);

      // Persist immediately so avatar does not get lost if user navigates away.
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ avatar_url: nextAvatarUrl })
        .eq("id", user.id);
      if (profileUpdateError) {
        throw profileUpdateError;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not upload avatar. Please try again.";
      Alert.alert("Upload failed", message);
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
        avatar_url: avatarUrl || null,
      });
      Alert.alert("Saved");
      navigation.goBack();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save";
      Alert.alert("Failed to save", message);
    }
  };

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingTop: 48, paddingBottom: 36 },
        title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 16 },
        avatarBlock: { alignItems: "center", marginBottom: 12 },
        avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { color: colors.text, fontSize: 28, fontWeight: "700" },
        avatarBtn: {
          marginTop: 10,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          minHeight: 36,
          justifyContent: "center",
        },
        avatarBtnText: { color: colors.text, fontWeight: "600", fontSize: 14 },
        label: { marginTop: 12, fontWeight: "600", color: colors.textMuted, fontSize: 13 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          marginTop: 6,
          fontSize: 14,
          color: colors.text,
          backgroundColor: colors.card,
        },
        disabledInput: { backgroundColor: colors.surface, color: colors.textMuted },
        inputError: { borderColor: colors.danger },
        errorText: { color: colors.danger, marginTop: 6, fontSize: 12 },
        btn: {
          marginTop: 24,
          ...primaryPressableStyle,
          borderWidth: 1,
          borderColor: AUTH_PRIMARY_COLOR,
        },
        btnText: primaryPressableTextStyle,
      }),
    [colors],
  );

  return (
    <ScrollView style={stylesThemed.root} contentContainerStyle={stylesThemed.content}>
      <Text style={stylesThemed.title}>Edit profile</Text>

      <View style={stylesThemed.avatarBlock}>
        {avatarUrl?.trim() ? (
          <SmartImage uri={avatarUrl} recyclingKey={avatarUrl} style={stylesThemed.avatar} contentFit="cover" />
        ) : (
          <View style={[stylesThemed.avatar, stylesThemed.avatarFallback]}>
            <Text style={stylesThemed.avatarFallbackText}>{(first || "U").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Pressable style={stylesThemed.avatarBtn} onPress={pickAvatar} disabled={uploadingAvatar}>
          {uploadingAvatar ? <ActivityIndicator color={colors.primary} /> : <Text style={stylesThemed.avatarBtnText}>Upload avatar</Text>}
        </Pressable>
      </View>

      <Text style={stylesThemed.label}>First name</Text>
      <TextInput style={stylesThemed.input} value={first} onChangeText={setFirst} placeholderTextColor={colors.textMuted} />
      <Text style={stylesThemed.label}>Last name</Text>
      <TextInput style={stylesThemed.input} value={last} onChangeText={setLast} placeholderTextColor={colors.textMuted} />
      <Text style={stylesThemed.label}>Email</Text>
      <TextInput style={[stylesThemed.input, stylesThemed.disabledInput]} value={profile?.email ?? user?.email ?? ""} editable={false} />
      <Text style={stylesThemed.label}>Phone</Text>
      <TextInput
        style={[stylesThemed.input, phoneError ? stylesThemed.inputError : null]}
        value={phone}
        onChangeText={handlePhoneChange}
        keyboardType="phone-pad"
        placeholder="X-(XXX)-XXX-XXXX"
        placeholderTextColor={colors.textMuted}
      />
      {phoneError ? <Text style={stylesThemed.errorText}>{phoneError}</Text> : null}
      <Pressable style={stylesThemed.btn} onPress={() => void save()} disabled={update.isPending || uploadingAvatar}>
        <Text style={stylesThemed.btnText}>{update.isPending ? "Saving..." : "Save"}</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function EditProfileScreen() {
  return <EditProfileScreenContent />;
}
