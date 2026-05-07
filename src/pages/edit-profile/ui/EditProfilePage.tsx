import { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  Keyboard,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile } from "@/entities/user";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/shared/api/supabase/client";
import { isAuthRequiredError, navigateToAuthScreen } from "@/lib/authRequired";
import { AUTH_PRIMARY_COLOR, primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { RichTextarea } from "@/shared/ui/rich-textarea/RichTextarea";

const PHONE_VALIDATION_PATTERN = /^\d-\(\d{3}\)-\d{3}-\d{4}$/;
const AVATARS_BUCKET = "avatars";
const KEYBOARD_GAP = 16;

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
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardInsetAnim = useRef(new Animated.Value(0)).current;
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const authNavigation = navigation as unknown as NavigationProp<ParamListBase>;
  const scrollRef = useRef<ScrollView>(null);
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(formatPhoneMask(profile?.phone ?? ""));
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhone(formatPhoneMask(profile.phone ?? ""));
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  }, [profile, user]);

  useEffect(() => {
    if (!profile?.avatar_url) {
      setAvatarUrl((user?.user_metadata?.avatar_url as string) ?? "");
    }
  }, [profile?.avatar_url, user]);

  useEffect(() => {
    const animateKeyboardInset = (toValue: number, duration?: number) => {
      Animated.timing(keyboardInsetAnim, {
        toValue,
        duration: duration ?? 250,
        useNativeDriver: false,
      }).start();
    };
    const getInsetFromEvent = (event: { endCoordinates: { height: number; screenY?: number } }) => {
      const windowHeight = Dimensions.get("window").height;
      const keyboardTop = event.endCoordinates.screenY ?? windowHeight - event.endCoordinates.height;
      const overlap = Math.max(0, windowHeight - keyboardTop);
      return (
        Platform.OS === "ios"
          ? Math.max(0, overlap - insets.bottom + KEYBOARD_GAP)
          : Math.max(0, overlap - tabBarHeight + KEYBOARD_GAP)
      );
    };
    const onKeyboardFrameChange = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      const nextInset = getInsetFromEvent(event);
      if (Platform.OS === "ios") return;
      animateKeyboardInset(nextInset, event.duration);
    };
    const onKeyboardWillShow = (event: { endCoordinates: { height: number; screenY?: number }; duration?: number }) => {
      if (Platform.OS !== "ios") return;
      const nextInset = getInsetFromEvent(event);
      animateKeyboardInset(nextInset, event.duration);
    };
    const onKeyboardHide = (event?: { duration?: number }) => {
      animateKeyboardInset(0, event?.duration);
    };
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const frameEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const frameSub = Keyboard.addListener(frameEvent, onKeyboardFrameChange);
    const showSub = Platform.OS === "ios" ? Keyboard.addListener("keyboardWillShow", onKeyboardWillShow) : null;
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);
    return () => {
      frameSub.remove();
      showSub?.remove();
      hideSub.remove();
    };
  }, [insets.bottom, keyboardInsetAnim, tabBarHeight]);

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
    if (!user?.id) {
      navigateToAuthScreen(authNavigation);
      return;
    }
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
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(authNavigation);
        return;
      }
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
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
      });
      Alert.alert("Saved");
      navigation.goBack();
    } catch (error: unknown) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(authNavigation);
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to save";
      Alert.alert("Failed to save", message);
    }
  };

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: 16, paddingTop: 12, paddingBottom: 36 },
        headerRow: {
          paddingTop: Math.max(insets.top, 10),
          paddingHorizontal: 16,
          height: Math.max(insets.top, 10) + 44,
          marginBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        headerTitleWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 8,
        },
        headerActionBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        headerTitle: {
          textAlign: "center",
          color: colors.text,
          fontSize: 34,
          fontWeight: "800",
          letterSpacing: -0.3,
        },
        avatarBlock: { alignItems: "center", marginBottom: 12 },
        avatarFrame: {
          position: "relative",
          width: 96,
          height: 96,
        },
        avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
        avatarFallback: { alignItems: "center", justifyContent: "center" },
        avatarFallbackText: { color: colors.text, fontSize: 28, fontWeight: "700" },
        avatarCameraBtn: {
          position: "absolute",
          top: -2,
          right: -2,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: mode === "dark" ? "#f4f4f5" : "#111827",
          borderWidth: 1,
          borderColor: mode === "dark" ? "#d4d4d8" : "#374151",
          alignItems: "center",
          justifyContent: "center",
        },
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
    [colors, insets.top, mode],
  );

  return (
    <View style={stylesThemed.root}>
      <Animated.View
        style={[
          stylesThemed.root,
          Platform.OS === "ios"
            ? { transform: [{ translateY: Animated.multiply(keyboardInsetAnim, -1) }] }
            : { paddingBottom: keyboardInsetAnim },
        ]}
      >
      <ScrollView
        ref={scrollRef}
        style={stylesThemed.root}
        contentContainerStyle={stylesThemed.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={stylesThemed.headerRow}>
          <Pressable style={stylesThemed.headerActionBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <View style={stylesThemed.headerTitleWrap}>
            <Text style={stylesThemed.headerTitle} numberOfLines={1}>
              Edit profile
            </Text>
          </View>
          <Pressable style={stylesThemed.headerActionBtn} onPress={toggleThemeMode}>
            <Ionicons name={mode === "dark" ? "sunny-outline" : "moon-outline"} size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={stylesThemed.avatarBlock}>
          <View style={stylesThemed.avatarFrame}>
            {avatarUrl?.trim() ? (
              <SmartImage uri={avatarUrl} recyclingKey={avatarUrl} style={stylesThemed.avatar} contentFit="cover" />
            ) : (
              <View style={[stylesThemed.avatar, stylesThemed.avatarFallback]}>
                <Text style={stylesThemed.avatarFallbackText}>{(first || "U").charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Pressable style={stylesThemed.avatarCameraBtn} onPress={pickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={mode === "dark" ? "#111827" : "#ffffff"} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={mode === "dark" ? "#111827" : "#ffffff"} />
              )}
            </Pressable>
          </View>
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
        <Text style={stylesThemed.label}>Bio</Text>
        <RichTextarea
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about yourself..."
          placeholderTextColor={colors.textMuted}
          style={[stylesThemed.input, { minHeight: 96, maxHeight: 180 }]}
        />
        <Pressable style={stylesThemed.btn} onPress={() => void save()} disabled={update.isPending || uploadingAvatar}>
          <Text style={stylesThemed.btnText}>{update.isPending ? "Saving..." : "Save"}</Text>
        </Pressable>
      </ScrollView>
      </Animated.View>
    </View>
  );
}

export default function EditProfileScreen() {
  return <EditProfileScreenContent />;
}
