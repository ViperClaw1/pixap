import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  Platform,
} from "react-native";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { getOptimizedImageUrl } from "@/shared/lib/imageUtils";
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
import {
  PhoneInput,
  DEFAULT_PHONE_VALUE,
  getPhoneValidationMessage,
  parseStoredPhone,
  serializePhone,
  type PhoneValue,
} from "@/shared/ui/phone-input";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useAndroidFullSwipeBackPanHandlers } from "@/shared/lib/useAndroidFullSwipeBackPanHandlers";

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

function EditProfileScreenContent() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardInsetAnim = useKeyboardInset({ tabBarHeight, gap: KEYBOARD_GAP });
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const authNavigation = navigation as unknown as NavigationProp<ParamListBase>;
  const scrollRef = useRef<ScrollView>(null);
  const stackNavigation = navigation as unknown as NavigationProp<ParamListBase>;
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phoneValue, setPhoneValue] = useState<PhoneValue>(DEFAULT_PHONE_VALUE);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    if (!profile) return;
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhoneValue(parseStoredPhone(profile.phone));
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  }, [profile, user]);

  useEffect(() => {
    if (!profile?.avatar_url) {
      setAvatarUrl((user?.user_metadata?.avatar_url as string) ?? "");
    }
  }, [profile?.avatar_url, user]);

  const handlePhoneChange = (next: PhoneValue) => {
    setPhoneValue(next);
    if (!phoneTouched) return;
    setPhoneError(getPhoneValidationMessage(next));
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
      setAvatarError(null);

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
    const trimmedFirst = first.trim();
    const trimmedLast = last.trim();
    const trimmedBio = bio.trim();
    const trimmedAvatar = avatarUrl.trim();
    const nextPhoneError = getPhoneValidationMessage(phoneValue);

    setFirstError(trimmedFirst ? null : "First name is required.");
    setLastError(trimmedLast ? null : "Last name is required.");
    setBioError(null);
    setAvatarError(null);
    setPhoneError(nextPhoneError);
    setPhoneTouched(true);

    if (!trimmedFirst || !trimmedLast || nextPhoneError) {
      return;
    }
    const phoneToSave = serializePhone(phoneValue) || null;
    try {
      await update.mutateAsync({
        first_name: trimmedFirst,
        last_name: trimmedLast,
        phone: phoneToSave,
        bio: trimmedBio || null,
        avatar_url: trimmedAvatar || null,
      });
      Alert.alert("Saved");
      stackNavigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
      const rootNavigation = stackNavigation.getParent<NavigationProp<ParamListBase>>();
      rootNavigation?.navigate("Profile", { screen: "ProfileMain" });
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
        phoneInputWrap: { marginTop: 6 },
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
    <View style={stylesThemed.root} {...androidSwipeBackPanHandlers}>
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
        <AppHeader
          title={t("header.editProfile")}
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
          rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
          onRightPress={toggleThemeMode}
        />

        <View style={stylesThemed.avatarBlock}>
          <View style={stylesThemed.avatarFrame}>
            {avatarUrl?.trim() ? (
              <SmartImage
                uri={getOptimizedImageUrl(avatarUrl, 220, 220, 74)}
                fallbackUri={avatarUrl}
                recyclingKey={avatarUrl}
                style={stylesThemed.avatar}
                contentFit="cover"
                skipBundledPlaceholder
              />
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
        <TextInput
          style={[stylesThemed.input, firstError ? stylesThemed.inputError : null]}
          value={first}
          onChangeText={(value) => {
            setFirst(value);
            if (firstError && value.trim()) setFirstError(null);
          }}
          placeholderTextColor={colors.textMuted}
        />
        {firstError ? <Text style={stylesThemed.errorText}>{firstError}</Text> : null}
        <Text style={stylesThemed.label}>Last name</Text>
        <TextInput
          style={[stylesThemed.input, lastError ? stylesThemed.inputError : null]}
          value={last}
          onChangeText={(value) => {
            setLast(value);
            if (lastError && value.trim()) setLastError(null);
          }}
          placeholderTextColor={colors.textMuted}
        />
        {lastError ? <Text style={stylesThemed.errorText}>{lastError}</Text> : null}
        <Text style={stylesThemed.label}>Email</Text>
        <TextInput style={[stylesThemed.input, stylesThemed.disabledInput]} value={profile?.email ?? user?.email ?? ""} editable={false} />
        <Text style={stylesThemed.label}>Phone</Text>
        <View style={stylesThemed.phoneInputWrap}>
          <PhoneInput
            value={phoneValue}
            onChange={handlePhoneChange}
            hasError={Boolean(phoneError)}
            onBlur={() => {
              setPhoneTouched(true);
              setPhoneError(getPhoneValidationMessage(phoneValue));
            }}
          />
        </View>
        {phoneError ? <Text style={stylesThemed.errorText}>{phoneError}</Text> : null}
        <Text style={stylesThemed.label}>Bio</Text>
        <RichTextarea
          value={bio}
          onChangeText={(value) => {
            setBio(value);
            if (bioError && value.trim()) setBioError(null);
          }}
          placeholder="Tell people about yourself..."
          placeholderTextColor={colors.textMuted}
          style={[stylesThemed.input, { minHeight: 96, maxHeight: 180 }, bioError ? stylesThemed.inputError : null]}
        />
        {bioError ? <Text style={stylesThemed.errorText}>{bioError}</Text> : null}
        {avatarError ? <Text style={stylesThemed.errorText}>{avatarError}</Text> : null}
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
