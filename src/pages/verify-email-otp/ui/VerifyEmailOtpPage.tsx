import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { OtpInput } from "react-native-otp-entry";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api/queryKeys";
import Toast from "react-native-toast-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import { useProfile } from "@/entities/user";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { primaryPressableStyle, primaryPressableTextStyle } from "@/shared/theme/primaryPressable";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "VerifyEmailOtp">;
type ScreenRoute = RouteProp<ProfileStackParamList, "VerifyEmailOtp">;

export default function VerifyEmailOtpPage() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, sendVerificationOtp, verifyEmailOtp, sendRecoveryOtp, verifyRecoveryOtp } = useAuth();
  const { data: profile } = useProfile();
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const flow = route.params?.flow ?? "verify";
  const flowEmail = route.params?.email?.trim() ?? "";
  const profileEmail = (profile?.email ?? user?.email ?? "").trim();
  const email = (flow === "recovery" ? flowEmail : profileEmail).toLowerCase();

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 20,
          justifyContent: "center",
        },
        backButton: {
          position: "absolute",
          top: Math.max(insets.top, 12),
          left: 16,
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        },
        title: {
          color: colors.text,
          fontSize: 32,
          fontWeight: "800",
          marginBottom: 10,
        },
        description: {
          color: colors.textMuted,
          fontSize: 14,
          lineHeight: 21,
          marginBottom: 22,
        },
        otpWrap: {
          marginBottom: 16,
          minHeight: 56,
          justifyContent: "center",
        },
        resendBtn: {
          minHeight: 42,
          alignSelf: "flex-start",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 0,
          paddingVertical: 0,
        },
        resendBtnText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: "700",
        },
        verifyBtn: {
          ...primaryPressableStyle,
          minHeight: 46,
          borderRadius: 12,
          marginTop: 14,
        },
        verifyBtnText: {
          ...primaryPressableTextStyle,
          fontSize: 15,
        },
      }),
    [colors, insets.top],
  );

  const sendCode = async () => {
    if (!email) {
      Toast.show({ type: "error", text1: "Verification failed", text2: "Email is missing." });
      return;
    }
    setSending(true);
    const { error } = flow === "verify" ? await sendVerificationOtp(email) : await sendRecoveryOtp(email);
    setSending(false);
    if (error) {
      Toast.show({ type: "error", text1: "Verification failed", text2: error });
      return;
    }
    Toast.show({
      type: "success",
      text1: "Verification code sent",
      text2: "Check your email and enter the 6-digit code.",
    });
  };

  useEffect(() => {
    void sendCode();
  }, []);

  const submitCode = async (nextCode: string) => {
    const normalized = nextCode.trim();
    if (!/^\d{6}$/.test(normalized) || verifying) return;

    setVerifying(true);
    const { error } =
      flow === "verify"
        ? await verifyEmailOtp(normalized)
        : await verifyRecoveryOtp(email, normalized);
    setVerifying(false);
    if (error) {
      Toast.show({ type: "error", text1: "Invalid code", text2: error });
      return;
    }

    if (flow === "verify") {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.user(user?.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
      navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] });
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: "ResetPassword" }] });
  };

  return (
    <View style={stylesThemed.root}>
      <Pressable
        style={stylesThemed.backButton}
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ProfileMain"))}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={stylesThemed.title}>Verify your email</Text>
      <Text style={stylesThemed.description}>
        {flow === "verify"
          ? `We sent a 6-digit verification code to ${email || "your email"}. Enter it below to confirm your account.`
          : `We sent a 6-digit password reset code to ${email || "your email"}. Enter it to continue.`}
      </Text>
      <View style={stylesThemed.otpWrap}>
        <OtpInput
          numberOfDigits={6}
          focusColor={colors.primary}
          theme={{
            pinCodeTextStyle: {
              color: colors.text,
              fontWeight: "700",
            },
            focusedPinCodeContainerStyle: {
              borderColor: colors.primary,
            },
            pinCodeContainerStyle: {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          }}
          onTextChange={(value) => setCode(value)}
          onFilled={(value) => {
            void submitCode(value);
          }}
        />
      </View>
      <Pressable style={stylesThemed.resendBtn} onPress={() => void sendCode()} disabled={sending}>
        {sending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={stylesThemed.resendBtnText}>Resend code</Text>
        )}
      </Pressable>
      <Pressable style={stylesThemed.verifyBtn} onPress={() => void submitCode(code)} disabled={verifying}>
        {verifying ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={stylesThemed.verifyBtnText}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}
