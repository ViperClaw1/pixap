import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError, type Session, type User } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { AppState, InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { env } from "@/shared/lib/env";
import { isInvalidRefreshTokenError } from "@/shared/lib/supabaseAuth";
import { queryKeys } from "@/shared/api/queryKeys";
import { clearSessionCaches } from "@/shared/lib/clearSessionCaches";
import {
  navigateAfterSignOut,
  resetSignOutNavigationGuard,
} from "@/shared/lib/auth/navigateAfterSignOut";
import { consumePendingPushOutbox, registerNativePushToken } from "@/shared/lib/push/pushNotifications";
import { syncProfileTimezone } from "@/entities/user/api/syncProfileTimezone";
import { devError, devInfo, devWarn } from "@/shared/lib/devLog";
import { resetBookingChatPersistedSession } from "@/features/ai-booking-chat";
import { clearOnboardingDraft } from "@/features/preference-onboarding";
import { identifyUser, resetAnalyticsIdentity } from "@/shared/lib/analytics/track";

export type AuthErrorCode =
  | "email_already_registered"
  | "invalid_email"
  | "missing_required_fields"
  | "weak_password"
  | "terms_required"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "too_many_requests"
  | "unauthorized"
  | "email_mismatch"
  | "invalid_otp"
  | "expired_otp"
  | "otp_send_failed"
  | "auth_service_unavailable"
  | "network_unavailable"
  | "unknown";

interface AuthActionResult {
  error: string | null;
  errorCode?: AuthErrorCode;
}

type SignInResult = AuthActionResult;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authHydrated: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    acceptTerms?: boolean,
  ) => Promise<AuthActionResult & { isUserAlreadyExists?: boolean }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
  updatePassword: (newPassword: string) => Promise<AuthActionResult>;
  resendVerification: (email: string) => Promise<AuthActionResult>;
  sendVerificationOtp: (email: string) => Promise<AuthActionResult>;
  verifyEmailOtp: (code: string) => Promise<AuthActionResult>;
  sendRecoveryOtp: (email: string) => Promise<AuthActionResult>;
  verifyRecoveryOtp: (email: string, code: string) => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  const isUserAlreadyExistsError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("already") ||
      normalized.includes("exists") ||
      normalized.includes("already registered") ||
      normalized.includes("user already")
    );
  };

  const classifyAuthMessage = (message: string, status?: number): AuthErrorCode => {
    const normalized = message.toLowerCase();
    if (isUserAlreadyExistsError(message) || status === 409) return "email_already_registered";
    if (normalized.includes("invalid email")) return "invalid_email";
    if (normalized.includes("missing required")) return "missing_required_fields";
    if (normalized.includes("password")) return "weak_password";
    if (normalized.includes("terms")) return "terms_required";
    if (normalized.includes("invalid login") || normalized.includes("invalid credentials")) return "invalid_credentials";
    if (normalized.includes("email not confirmed")) return "email_not_confirmed";
    if (normalized.includes("too many") || status === 429) return "too_many_requests";
    if (normalized.includes("unauthorized") || status === 401) return "unauthorized";
    if (normalized.includes("email does not match") || status === 403) return "email_mismatch";
    if (normalized.includes("expired")) return "expired_otp";
    if (normalized.includes("verification code") || normalized.includes("verification payload") || normalized.includes("otp")) {
      return "invalid_otp";
    }
    if (normalized.includes("send") || normalized.includes("create verification") || normalized.includes("reset code")) {
      return "otp_send_failed";
    }
    if (status != null && status >= 500) return "auth_service_unavailable";
    return "unknown";
  };

  const parseFunctionErrorPayload = async (error: FunctionsHttpError): Promise<{ error?: unknown }> => {
    try {
      return (await error.context.json()) as { error?: unknown };
    } catch {
      return {};
    }
  };

  const authResultFromFunctionError = async (error: unknown, fallbackMessage: string): Promise<AuthActionResult> => {
    if (error instanceof FunctionsHttpError) {
      const payload = await parseFunctionErrorPayload(error);
      const message = typeof payload.error === "string" ? payload.error : error.message;
      return { error: message, errorCode: classifyAuthMessage(message, error.context.status) };
    }
    if (error instanceof FunctionsFetchError) {
      return { error: error.message, errorCode: "network_unavailable" };
    }
    if (error instanceof FunctionsRelayError) {
      return { error: error.message, errorCode: "auth_service_unavailable" };
    }
    if (error instanceof Error) {
      return { error: error.message, errorCode: classifyAuthMessage(error.message) };
    }
    return { error: fallbackMessage, errorCode: "unknown" };
  };

  const authResultFromResponseError = (message: string): AuthActionResult => ({
    error: message,
    errorCode: classifyAuthMessage(message),
  });

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authHydrated, setAuthHydrated] = useState(false);
  const initializedRef = useRef(false);

  const getEmailCallbackRedirectUrl = useCallback(
    () => {
      if (Constants.appOwnership === "expo") {
        return Linking.createURL("profile/auth-email-callback");
      }
      return `${env.oauthRedirectBase.replace(/\/$/, "")}/profile/auth-email-callback`;
    },
    [],
  );

  useEffect(() => {
    let active = true;

    const applySession = (next: Session | null) => {
      if (!active) return;
      setSession(next);
      setUser(next?.user ?? null);
    };

    const finishInit = () => {
      if (!active || initializedRef.current) return;
      initializedRef.current = true;
      setAuthHydrated(true);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
        applySession(next);
      }
      if (event === "SIGNED_IN") {
        resetSignOutNavigationGuard();
        if (next?.user) identifyUser(next.user.id, { email: next.user.email, created_at: next.user.created_at });
        void queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
        void queryClient.invalidateQueries({ queryKey: queryKeys.businessCards.listPrefix });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecommendations.prefix });
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      }
      if (event === "SIGNED_OUT") {
        resetAnalyticsIdentity();
        navigateAfterSignOut();
        void clearSessionCaches(queryClient);
        void resetBookingChatPersistedSession();
        void clearOnboardingDraft();
      }
      if (event === "INITIAL_SESSION" && next?.user) {
        identifyUser(next.user.id, { email: next.user.email, created_at: next.user.created_at });
      }
      if (event === "INITIAL_SESSION") finishInit();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const register = () => {
      void syncProfileTimezone();
      void registerNativePushToken(user.id);
      void consumePendingPushOutbox();
    };
    const task = InteractionManager.runAfterInteractions(register);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") register();
    });
    return () => {
      task.cancel();
      sub.remove();
    };
  }, [user?.id]);

  const signUp = useCallback(
    async (email: string, password: string, firstName: string, lastName: string, acceptTerms = false) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-signup", {
        body: {
          email,
          password,
          firstName,
          lastName,
          acceptTerms,
          redirectTo: getEmailCallbackRedirectUrl(),
        },
      });
      if (error) {
        const result = await authResultFromFunctionError(error, "Sign up failed");
        return { ...result, isUserAlreadyExists: result.errorCode === "email_already_registered" };
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        const message = String(data.error);
        const result = authResultFromResponseError(message);
        return { ...result, isUserAlreadyExists: result.errorCode === "email_already_registered" };
      }
      return { error: null };
    },
    [getEmailCallbackRedirectUrl],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message ?? "Sign in failed";
      return { error: message, errorCode: classifyAuthMessage(message, error.status) };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
    if (isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    devWarn("[auth] signOut network error, falling back to local scope:", error.message);
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-recovery", {
        body: {
          email,
          redirectTo: getEmailCallbackRedirectUrl(),
        },
      });
      if (error) return await authResultFromFunctionError(error, "Password reset failed");
      if (data && typeof data === "object" && "error" in data && data.error) return authResultFromResponseError(String(data.error));
      return { error: null };
    },
    [getEmailCallbackRedirectUrl],
  );

  const updatePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) return { error: null };
    const message = error.message ?? "Password update failed";
    return { error: message, errorCode: classifyAuthMessage(message, error.status) };
  }, []);

  const sendVerificationOtp = useCallback(async (email: string): Promise<AuthActionResult> => {
    devInfo("[auth][sendVerificationOtp] invoke auth-email-verify", { email });
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-verify", {
      body: {
        email,
      },
    });
    if (error) {
      devError("[auth][sendVerificationOtp] edge invoke error:", error.message);
      return await authResultFromFunctionError(error, "Failed to send verification code");
    }
    if (data && typeof data === "object" && "error" in data && data.error) {
      const message = String(data.error);
      devError("[auth][sendVerificationOtp] edge response error:", message);
      return authResultFromResponseError(message);
    }
    devInfo("[auth][sendVerificationOtp] edge invoke success");
    return { error: null };
  }, []);

  const verifyEmailOtp = useCallback(async (code: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-verify-otp", {
      body: { code },
    });
    if (error) return await authResultFromFunctionError(error, "Failed to verify email");
    if (data && typeof data === "object" && "error" in data && data.error) return authResultFromResponseError(String(data.error));
    return { error: null };
  }, []);

  const sendRecoveryOtp = useCallback(async (email: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-recovery", {
      body: { action: "send", email },
    });
    if (error) return await authResultFromFunctionError(error, "Failed to send recovery code");
    if (data && typeof data === "object" && "error" in data && data.error) return authResultFromResponseError(String(data.error));
    return { error: null };
  }, []);

  const verifyRecoveryOtp = useCallback(async (email: string, code: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      error?: string;
      session?: { access_token?: string; refresh_token?: string };
    }>("auth-email-recovery", {
      body: { action: "verify", email, code },
    });
    if (error) return await authResultFromFunctionError(error, "Failed to verify recovery code");
    if (data && typeof data === "object" && "error" in data && data.error) return authResultFromResponseError(String(data.error));

    const accessToken = data?.session?.access_token;
    const refreshToken = data?.session?.refresh_token;
    if (!accessToken || !refreshToken) return { error: "Recovery session is missing", errorCode: "auth_service_unavailable" };

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setSessionError) {
      const message = setSessionError.message;
      return { error: message, errorCode: classifyAuthMessage(message, setSessionError.status) };
    }
    return { error: null };
  }, []);

  const resendVerification = useCallback(
    async (email: string) => {
      const result = await sendVerificationOtp(email);
      devInfo("[auth][resendVerification] deprecated alias used");
      return result;
    },
    [sendVerificationOtp],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      authHydrated,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      resendVerification,
      sendVerificationOtp,
      verifyEmailOtp,
      sendRecoveryOtp,
      verifyRecoveryOtp,
    }),
    [
      user,
      session,
      loading,
      authHydrated,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      resendVerification,
      sendVerificationOtp,
      verifyEmailOtp,
      sendRecoveryOtp,
      verifyRecoveryOtp,
    ],
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
