import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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
import { mergeStaticAndThemed } from "@/shared/theme/mergeThemeStyles";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { verifyEmailOtpStaticStyles, verifyEmailOtpThemeStyles } from "./verifyEmailOtpStyles";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "VerifyEmailOtp">;
type ScreenRoute = RouteProp<ProfileStackParamList, "VerifyEmailOtp">;

const RESEND_COOLDOWN_SEC = 60;

function formatResendCooldown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const initialSendStartedRef = useRef(false);
  const resendCooldownRef = useRef(0);
  resendCooldownRef.current = resendCooldown;

  const flow = route.params?.flow ?? "verify";
  const flowEmail = route.params?.email?.trim() ?? "";
  const profileEmail = (profile?.email ?? user?.email ?? "").trim();
  const email = (flow === "recovery" ? flowEmail : profileEmail).toLowerCase();

  const themed = useThemeStyles(
    ({ colors: c }) => verifyEmailOtpThemeStyles(c, insets.top),
    [insets.top],
  );
  const styles = useMemo(
    () => mergeStaticAndThemed(verifyEmailOtpStaticStyles, themed),
    [themed],
  );

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendCode = useCallback(async () => {
    if (!email) {
      Toast.show({ type: "error", text1: "Verification failed", text2: "Email is missing." });
      return;
    }
    if (sending || resendCooldownRef.current > 0) return;

    setSending(true);
    const { error } = flow === "verify" ? await sendVerificationOtp(email) : await sendRecoveryOtp(email);
    setSending(false);
    if (error) {
      Toast.show({ type: "error", text1: "Verification failed", text2: error });
      return;
    }
    setResendCooldown(RESEND_COOLDOWN_SEC);
    Toast.show({
      type: "success",
      text1: "Verification code sent",
      text2: "Check your email and enter the 6-digit code.",
    });
  }, [email, flow, sendRecoveryOtp, sendVerificationOtp, sending]);

  useEffect(() => {
    if (initialSendStartedRef.current) return;
    initialSendStartedRef.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once on mount
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
    <View style={styles.root}>
      <Pressable
        style={styles.backButton}
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("ProfileMain"))}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.description}>
        {flow === "verify"
          ? `We sent a 6-digit verification code to ${email || "your email"}. Enter it below to confirm your account.`
          : `We sent a 6-digit password reset code to ${email || "your email"}. Enter it to continue.`}
      </Text>
      <View style={styles.otpWrap}>
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
      <Pressable
        style={styles.resendBtn}
        onPress={() => void sendCode()}
        disabled={sending || resendCooldown > 0}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text
            style={[
              styles.resendBtnText,
              resendCooldown > 0 ? styles.resendBtnTextDisabled : themed.resendBtnText,
            ]}
          >
            {resendCooldown > 0
              ? `Resend code in ${formatResendCooldown(resendCooldown)}`
              : "Resend code"}
          </Text>
        )}
      </Pressable>
      <Pressable style={styles.verifyBtn} onPress={() => void submitCode(code)} disabled={verifying}>
        {verifying ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={styles.verifyBtnText}>Verify</Text>
        )}
      </Pressable>
    </View>
  );
}
