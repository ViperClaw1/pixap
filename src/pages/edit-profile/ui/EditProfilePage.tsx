import { AppPressable } from "@/shared/ui/app-pressable";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { appAlert } from "@/shared/ui/app-popup";
import { useScrollToFocusedInput } from "@/shared/lib/keyboard";
import { Ionicons } from "@expo/vector-icons";
import { UserAvatarImage } from "@/shared/ui/user-avatar-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProfileStackParamList } from "@/app/navigation/types";
import {
  leaveAfterEditProfileSave,
  leaveEditProfileScreen,
  openPreferenceOnboardingFromEditProfile,
} from "@/app/navigation/navigationHelpers";
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

type UsernameValidationError =
  | { key: "usernameRequired" }
  | { key: "usernameMinLength"; min: number }
  | { key: "usernameMaxLength"; max: number }
  | { key: "usernameInvalidChars" };

const validateUsername = (value: string): UsernameValidationError | null => {
  const trimmed = value.trim();
  if (!trimmed) return { key: "usernameRequired" };
  if (trimmed.length < USERNAME_MIN_LENGTH) return { key: "usernameMinLength", min: USERNAME_MIN_LENGTH };
  if (trimmed.length > USERNAME_MAX_LENGTH) return { key: "usernameMaxLength", max: USERNAME_MAX_LENGTH };
  if (!USERNAME_REGEX.test(trimmed)) return { key: "usernameInvalidChars" };
  return null;
};

function EditProfileScreenContent() {
  const { t } = useTranslation();

  const translateUsernameError = useCallback(
    (err: UsernameValidationError | null): string | null => {
      if (!err) return null;
      switch (err.key) {
        case "usernameRequired": return t("editProfile.usernameRequired");
        case "usernameMinLength": return t("editProfile.usernameMinLength", { min: err.min });
        case "usernameMaxLength": return t("editProfile.usernameMaxLength", { max: err.max });
        case "usernameInvalidChars": return t("editProfile.usernameInvalidChars");
      }
    },
    [t],
  );

  const getPhoneError = useCallback(
    (value: PhoneValue) =>
      getPhoneValidationMessage(value, {
        messages: {
          required: t("editProfile.phoneRequired"),
          invalid: t("editProfile.phoneInvalid"),
        },
      }),
    [t],
  );
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, "EditProfile">>();
  const insets = useSafeAreaInsets();
  const leaveEditProfile = useCallback(() => leaveEditProfileScreen(navigation), [navigation]);
  const androidSwipeBackPanHandlers = useAndroidFullSwipeBackPanHandlers(navigation, {
    swipeBackFallback: leaveEditProfile,
  });
  const { colors, mode, setMode } = useAppTheme();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const authAvatarUrl = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : "";
  const authEmail = user?.email;
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetYRef = useRef(0);
  const { onInputFocus, onScroll } = useScrollToFocusedInput(scrollRef, { scrollOffsetYRef });
  const usernameInputRef = useRef<TextInput>(null);
  const firstInputRef = useRef<TextInput>(null);
  const lastInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  const update = useUpdateProfile();
  const uploadProfileAvatar = useUploadProfileAvatar();
  const [username, setUsername] = useState(
    profile?.username?.trim() || deriveDefaultUsername(profile?.email ?? authEmail),
  );
  const [first, setFirst] = useState(profile?.first_name ?? "");
  const [last, setLast] = useState(profile?.last_name ?? "");
  const [phoneValue, setPhoneValue] = useState<PhoneValue>(DEFAULT_PHONE_VALUE);
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(profile?.avatar_url ?? authAvatarUrl);
  const [avatarBlurhash, setAvatarBlurhash] = useState<string | null>(profile?.avatar_blurhash ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [firstError, setFirstError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [avatarSourcePickerVisible, setAvatarSourcePickerVisible] = useState(false);
  const initializedProfileIdRef = useRef<string | null>(null);

  const toggleThemeMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  useEffect(() => {
    initializedProfileIdRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!profile) return;
    if (user?.id && profile.id !== user.id) return;
    if (initializedProfileIdRef.current === profile.id) return;
    initializedProfileIdRef.current = profile.id;
    const storedUsername = profile.username?.trim();
    setUsername(storedUsername || deriveDefaultUsername(profile.email ?? authEmail));
    setFirst(profile.first_name ?? "");
    setLast(profile.last_name ?? "");
    setPhoneValue(parseStoredPhone(profile.phone));
    setBio(profile.bio ?? "");
  }, [authEmail, profile, user?.id]);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? authAvatarUrl);
    setAvatarBlurhash(profile?.avatar_blurhash ?? null);
  }, [authAvatarUrl, profile?.avatar_blurhash, profile?.avatar_url]);

  const handlePhoneChange = (next: PhoneValue) => {
    setPhoneValue(next);
    if (!phoneTouched) return;
    setPhoneError(getPhoneError(next));
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
      const message = error instanceof Error ? error.message : t("editProfile.uploadAvatarFailedMessage");
      appAlert(t("editProfile.uploadAvatarFailed"), message, undefined, "alert");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickAvatarFromCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        appAlert(t("editProfile.permissionNeeded"), t("editProfile.cameraPermissionMessage"), undefined, "alert");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("editProfile.cameraUnavailableMessage");
      appAlert(t("editProfile.cameraUnavailable"), message, undefined, "alert");
    }
  };

  const pickAvatarFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        appAlert(t("editProfile.permissionNeeded"), t("editProfile.galleryPermissionMessage"), undefined, "alert");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        base64: false,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("editProfile.galleryUnavailableMessage");
      appAlert(t("editProfile.galleryUnavailable"), message, undefined, "alert");
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
    const nextUsernameError = translateUsernameError(validateUsername(normalizedUsername));
    const nextPhoneError = getPhoneError(phoneValue);

    setUsernameError(nextUsernameError);
    setFirstError(trimmedFirst ? null : t("editProfile.firstNameRequired"));
    setLastError(trimmedLast ? null : t("editProfile.lastNameRequired"));
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
      appAlert(
        t("editProfile.savedTitle"),
        t("editProfile.savedBody"),
        [
          { text: t("common.ok"), onPress: () => leaveAfterEditProfileSave(navigation) },
          {
            text: t("editProfile.personalizeCta"),
            onPress: () => openPreferenceOnboardingFromEditProfile(navigation),
          },
        ],
        "success",
      );
    } catch (error: unknown) {
      if (isAuthRequiredError(error)) {
        navigateToAuthScreen(navigation);
        return;
      }
      const message = error instanceof Error ? error.message : t("editProfile.saveFailed");
      appAlert(t("editProfile.saveFailed"), message, undefined, "alert");
    }
  };

  const themed = useThemeStyles(({ colors: c, mode: m }) => editProfileThemeStyles(c, m));
  const styles = useMemo(
    () => mergeStaticAndThemed(editProfileStaticStyles, themed),
    [themed],
  );
  const displayEmail = (profile?.email ?? user?.email ?? "").trim();

  return (
    <View style={styles.root} {...androidSwipeBackPanHandlers}>
      <AppHeader
        title={t("header.editProfile")}
        compactTitle
        leftIcon="arrow-back"
        onLeftPress={leaveEditProfile}
        rightIcon={mode === "dark" ? "sunny-outline" : "moon-outline"}
        onRightPress={toggleThemeMode}
      />
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          style={styles.root}
          contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
        <View style={styles.avatarBlock}>
          <View style={styles.avatarFrame}>
            <UserAvatarImage
              uri={avatarUrl?.trim() || null}
              recyclingKey={avatarUrl || "edit-profile-avatar"}
              blurhash={avatarBlurhash ?? undefined}
              style={styles.avatar}
              contentFit="cover"
              iconSize={48}
            />
            <AppPressable style={styles.avatarCameraBtn} onPress={pickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Ionicons name="camera-outline" size={16} color={colors.onPrimary} />
              )}
            </AppPressable>
          </View>
          {displayEmail ? (
            <Text style={styles.avatarEmail} numberOfLines={1}>
              {displayEmail}
            </Text>
          ) : null}
        </View>

        <Text style={styles.label}>{t("editProfile.usernameLabel")}</Text>
        <TextInput
          ref={usernameInputRef}
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
          placeholder={t("editProfile.usernamePlaceholder")}
          placeholderTextColor={colors.textMuted}
          onFocus={() => onInputFocus(usernameInputRef)}
        />
        {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
        <Text style={styles.label}>{t("editProfile.firstNameLabel")}</Text>
        <TextInput
          ref={firstInputRef}
          style={[styles.input, firstError ? styles.inputError : null]}
          value={first}
          onChangeText={(value) => {
            setFirst(value);
            if (firstError && value.trim()) setFirstError(null);
          }}
          placeholder={t("editProfile.firstNamePlaceholder")}
          placeholderTextColor={colors.textMuted}
          onFocus={() => onInputFocus(firstInputRef)}
        />
        {firstError ? <Text style={styles.errorText}>{firstError}</Text> : null}
        <Text style={styles.label}>{t("editProfile.lastNameLabel")}</Text>
        <TextInput
          ref={lastInputRef}
          style={[styles.input, lastError ? styles.inputError : null]}
          value={last}
          onChangeText={(value) => {
            setLast(value);
            if (lastError && value.trim()) setLastError(null);
          }}
          placeholder={t("editProfile.lastNamePlaceholder")}
          placeholderTextColor={colors.textMuted}
          onFocus={() => onInputFocus(lastInputRef)}
        />
        {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
        <Text style={styles.label}>{t("editProfile.phoneLabel")}</Text>
        <View style={styles.phoneInputWrap}>
          <PhoneInput
            value={phoneValue}
            onChange={handlePhoneChange}
            hasError={Boolean(phoneError)}
            inputRef={phoneInputRef}
            placeholder={t("editProfile.phonePlaceholder")}
            onFocus={() => onInputFocus(phoneInputRef)}
            onBlur={() => {
              setPhoneTouched(true);
              setPhoneError(getPhoneError(phoneValue));
            }}
          />
        </View>
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
        <Text style={styles.label}>{t("editProfile.bioLabel")}</Text>
        <RichTextarea
          ref={bioInputRef}
          value={bio}
          onChangeText={setBio}
          placeholder={t("editProfile.bioPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 96, maxHeight: 180 }]}
          onFocus={() => onInputFocus(bioInputRef)}
        />
        {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}
        <AppPressable style={styles.btn} onPress={() => void save()} disabled={update.isPending || uploadingAvatar}>
          <Text style={styles.btnText}>{update.isPending ? t("editProfile.saving") : t("editProfile.save")}</Text>
        </AppPressable>
        </ScrollView>
      </View>
      <StorySourcePickerModal
        visible={avatarSourcePickerVisible}
        onClose={() => setAvatarSourcePickerVisible(false)}
        onChoose={onChooseAvatarSource}
        title={t("editProfile.chooseAvatarTitle")}
        subtitle={t("editProfile.chooseAvatarSubtitle")}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  return <EditProfileScreenContent />;
}
