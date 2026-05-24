import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { appAlert } from "@/shared/ui/app-popup";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardInset } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { asParamListNavigation } from "@/app/navigation/appNavigation";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile, useUploadProfileAvatar } from "@/entities/user";
import { useAuth } from "@/app/providers/AuthProvider";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { isAuthRequiredError, navigateToAuthScreen } from "@/shared/lib/auth/authRequired";
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { editProfileStaticStyles, editProfileThemeStyles } from "./editProfileStyles";
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
import {
  StorySourcePickerModal,
  type StorySourceOption,
} from "@/shared/ui/story-source-picker/StorySourcePickerModal";

const KEYBOARD_GAP = 16;

const USERNAME_REGEX = /^[a-z0-9._-]+$/;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;

const sanitizeUsernameFromEmailLocalPart = (localPart: string): string => {
  const normalized = localPart.trim().toLowerCase();
  return normalized.replace(/[^a-z0-9._-]/g, "_").slice(0, USERNAME_MAX_LENGTH);
};

const deriveDefaultUsername = (email?: string | null): string => {
  const local = (email ?? "").split("@")[0] ?? "";
  return sanitizeUsernameFromEmailLocalPart(local);
};

const validateUsername = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return "Username is required.";
  if (trimmed.length < USERNAME_MIN_LENGTH) return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  if (trimmed.length > USERNAME_MAX_LENGTH) return `Username must be at most ${USERNAME_MAX_LENGTH} characters.`;
  if (!USERNAME_REGEX.test(trimmed)) return "Username can only contain lowercase letters, numbers, '.', '_' or '-'.";
  return null;
};

function EditProfileScreenContent() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, "EditProfile">>();
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation);
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardInsetAnim = useKeyboardInset({ tabBarHeight, gap: KEYBOARD_GAP });
  const isIos = Platform.OS === "ios";
  const keyboardWrapStyle = useAnimatedStyle(() => {
    if (isIos) {
      return { transform: [{ translateY: -keyboardInsetAnim.value }] };
    }
    return { paddingBottom: keyboardInsetAnim.value };
  }, [isIos, keyboardInsetAnim]);

  const update = useUpdateProfile();
  const uploadProfileAvatar = useUploadProfileAvatar();
  const scrollRef = useRef<ScrollView>(null);
  const [username, setUsername] = useState(
    profile?.username?.trim() || deriveDefaultUsername(profile?.email ?? user?.email),
  );
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phoneValue, setPhoneValue] = useState<PhoneValue>(DEFAULT_PHONE_VALUE);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
  const [avatarBlurhash, setAvatarBlurhash] = useState<string | null>(profile?.avatar_blurhash ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [avatarSourcePickerVisible, setAvatarSourcePickerVisible] = useState(false);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    if (!profile) return;
    const storedUsername = profile.username?.trim();
    setUsername(storedUsername || deriveDefaultUsername(profile.email ?? user?.email));
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhoneValue(parseStoredPhone(profile.phone));
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url ?? ((user?.user_metadata?.avatar_url as string) ?? ""));
    setAvatarBlurhash(profile.avatar_blurhash ?? null);
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
    setAvatarSourcePickerVisible(true);
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.id) {
      navigateToAuthScreen(navigation);
      return;
    }
    setUploadingAvatar(true);
    try {
      const { avatarUrl: nextAvatarUrl, blurhash } = await uploadProfileAvatar.mutateAsync(asset);
      setAvatarUrl(nextAvatarUrl);
      setAvatarBlurhash(blurhash);
      setAvatarError(null);
    } catch (error: unknown) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      const message = error instanceof Error ? error.message : "Could not upload avatar. Please try again.";
      appAlert("Upload failed", message, undefined, "alert");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickAvatarFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        appAlert("Permission needed", "Camera access is required to take a photo.", undefined, "alert");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not open the camera.";
      appAlert("Camera unavailable", message, undefined, "alert");
    }
  };

  const pickAvatarFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        appAlert("Permission needed", "Storage access is required to choose a photo.", undefined, "alert");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not open the photo library.";
      appAlert("Gallery unavailable", message, undefined, "alert");
    }
  };

  const onChooseAvatarSource = (source: StorySourceOption) => {
    setAvatarSourcePickerVisible(false);
    if (source === "camera") {
      void pickAvatarFromCamera();
      return;
    }
    void pickAvatarFromGallery();
  };

  const save = async () => {
    const normalizedUsername = username.trim().toLowerCase();
    const trimmedFirst = first.trim();
    const trimmedLast = last.trim();
    const trimmedBio = bio.trim();
    const trimmedAvatar = avatarUrl.trim();
    const nextUsernameError = validateUsername(normalizedUsername);
    const nextPhoneError = getPhoneValidationMessage(phoneValue);

    setUsernameError(nextUsernameError);
    setFirstError(trimmedFirst ? null : "First name is required.");
    setLastError(trimmedLast ? null : "Last name is required.");
    setAvatarError(null);
    setPhoneError(nextPhoneError);
    setPhoneTouched(true);

    if (nextUsernameError || !trimmedFirst || !trimmedLast || nextPhoneError) {
      return;
    }
    const phoneToSave = serializePhone(phoneValue) || null;
    try {
      await update.mutateAsync({
        username: normalizedUsername,
        first_name: trimmedFirst,
        last_name: trimmedLast,
        phone: phoneToSave,
        bio: trimmedBio || null,
        avatar_url: trimmedAvatar || null,
      });
      const stackNavigation = asParamListNavigation(navigation);
      const goToProfile = () => {
        stackNavigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
        const rootNavigation = stackNavigation.getParent();
        rootNavigation?.navigate("Profile", { screen: "ProfileMain" });
      };
      appAlert(
        t("editProfile.savedTitle"),
        t("editProfile.savedBody"),
        [
          { text: t("common.ok"), onPress: goToProfile },
          {
            text: t("editProfile.personalizeCta"),
            onPress: () => navigation.navigate("PreferenceOnboarding", { source: "edit_profile" }),
          },
        ],
        "success",
      );
    } catch (error: unknown) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to save";
      appAlert("Failed to save", message, undefined, "alert");
    }
  };

  const themed = useThemeStyles(({ colors: c, mode: m }) => editProfileThemeStyles(c, m));
  const styles = useMemo(
    () => mergeStaticAndThemed(editProfileStaticStyles, themed),
    [themed],
  );

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <Animated.View style={[styles.root, keyboardWrapStyle]}>
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.content}
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

        <View style={styles.avatarBlock}>
          <View style={styles.avatarFrame}>
            <UserAvatarImage
              uri={avatarUrl?.trim() || null}
              recyclingKey={avatarUrl || "edit-profile-avatar"}
              blurhash={avatarBlurhash}
              style={styles.avatar}
              contentFit="cover"
              iconSize={48}
            />
            <Pressable style={styles.avatarCameraBtn} onPress={pickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={colors.onPrimary} />
              )}
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, usernameError ? styles.inputError : null]}
          value={username}
          onChangeText={(value) => {
            const next = value.toLowerCase().slice(0, USERNAME_MAX_LENGTH);
            setUsername(next);
            if (usernameError && !validateUsername(next)) setUsernameError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder="username"
          placeholderTextColor={colors.textMuted}
        />
        {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
        <Text style={styles.label}>First name</Text>
        <TextInput
          style={[styles.input, firstError ? styles.inputError : null]}
          value={first}
          onChangeText={(value) => {
            setFirst(value);
            if (firstError && value.trim()) setFirstError(null);
          }}
          placeholderTextColor={colors.textMuted}
        />
        {firstError ? <Text style={styles.errorText}>{firstError}</Text> : null}
        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={[styles.input, lastError ? styles.inputError : null]}
          value={last}
          onChangeText={(value) => {
            setLast(value);
            if (lastError && value.trim()) setLastError(null);
          }}
          placeholderTextColor={colors.textMuted}
        />
        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
        <Text style={styles.label}>Email</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={profile?.email ?? user?.email ?? ""} editable={false} />
        <Text style={styles.label}>Phone</Text>
        <View style={styles.phoneInputWrap}>
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
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
        <Text style={styles.label}>Bio (optional)</Text>
        <RichTextarea
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about yourself..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 96, maxHeight: 180 }]}
        />
        {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}
        <Pressable style={styles.btn} onPress={() => void save()} disabled={update.isPending || uploadingAvatar}>
          <Text style={styles.btnText}>{update.isPending ? "Saving..." : "Save"}</Text>
        </Pressable>
      </ScrollView>
      </Animated.View>
      <StorySourcePickerModal
        visible={avatarSourcePickerVisible}
        onClose={() => setAvatarSourcePickerVisible(false)}
        onChoose={onChooseAvatarSource}
        title="Choose avatar"
        subtitle="Select where to pick your photo from."
      />
    </View>
  );
}

export default function EditProfileScreen() {
  return <EditProfileScreenContent />;
}
