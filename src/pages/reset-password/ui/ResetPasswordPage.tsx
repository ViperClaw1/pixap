import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView, Platform, Keyboard } from "react-native";
import * as Linking from "expo-linking";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileStackParamList } from "@/navigation/types";
import { useAppTheme } from "@/contexts/ThemeContext";
import Toast from "react-native-toast-message";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";
import { supabase } from "@/shared/api/supabase/client";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "ResetPassword">;

/** Handles deep-link tokens from email; user sets new password here. */
export default function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const url = Linking.useURL();

  useEffect(() => {
    if (!__DEV__) return;
    console.info("[ResetPassword] Screen mounted.");
    console.info("[ResetPassword] Incoming URL:", url ?? "<empty>");
    void supabase.auth.getSession().then(({ data: { session } }) => {
      console.info("[ResetPassword] Session available:", Boolean(session?.access_token));
      console.info("[ResetPassword] Session user:", session?.user?.id ?? "<none>");
    });
  }, [url]);

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
        content: {
          paddingTop: Math.max(insets.top, 24),
          paddingBottom: Math.max(insets.bottom, 24),
        },
        title: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 8 },
        hint: { color: colors.textMuted, marginBottom: 16, fontSize: 14 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          fontSize: 16,
          color: colors.text,
          backgroundColor: colors.card,
        },
        btn: { ...primaryPressableStyle, marginTop: 8, borderRadius: 12 },
        btnDisabled: { opacity: 0.6 },
        btnText: primaryPressableTextStyle,
      }),
    [colors, insets.top, insets.bottom],
  );

  return (
    <ScrollView
      style={stylesThemed.root}
      contentContainerStyle={stylesThemed.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
    >
      <Text style={stylesThemed.title}>Reset password</Text>
      {url ? (
        <Text style={stylesThemed.hint}>Link received. Enter a new password below.</Text>
      ) : (
        <Text style={stylesThemed.hint}>Choose a new password for your account.</Text>
      )}
      <TextInput
        style={stylesThemed.input}
        placeholder="New password"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={stylesThemed.input}
        placeholder="Confirm password"
        placeholderTextColor={colors.textMuted}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />
      {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> : null}
      <Pressable
        style={[stylesThemed.btn, busy ? stylesThemed.btnDisabled : null]}
        disabled={busy}
        onPress={async () => {
          if (__DEV__) {
            console.info("[ResetPassword] Submit pressed.");
          }
          Keyboard.dismiss();
          if (password.length < 8) {
            if (__DEV__) {
              console.info("[ResetPassword] Validation failed: password too short.");
            }
            Alert.alert("Too short", "Use at least 8 characters.");
            return;
          }
          if (password !== confirm) {
            if (__DEV__) {
              console.info("[ResetPassword] Validation failed: password mismatch.");
            }
            Alert.alert("Mismatch", "Passwords do not match.");
            return;
          }
          setBusy(true);
          try {
            const { error } = await updatePassword(password);
            if (error) {
              if (__DEV__) {
                console.info("[ResetPassword] Password update failed:", error);
              }
              Toast.show({ type: "error", text1: "Could not update password", text2: error });
              return;
            }
            if (__DEV__) {
              console.info("[ResetPassword] Password updated successfully. Navigating to ProfileMain.");
            }
            Toast.show({
              type: "success",
              text1: "Password updated",
              text2: "You're signed in. Welcome back.",
            });
            navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Text style={stylesThemed.btnText}>Update password</Text>
      </Pressable>
    </ScrollView>
  );
}
