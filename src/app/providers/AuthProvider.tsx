import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { AppState, InteractionManager } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { env } from "@/shared/lib/env";
import { isInvalidRefreshTokenError } from "@/shared/lib/supabaseAuth";
import { clearSessionCaches } from "@/shared/lib/clearSessionCaches";
import { consumePendingPushOutbox, registerNativePushToken } from "@/shared/lib/push/pushNotifications";
import { devError, devInfo, devWarn } from "@/shared/lib/devLog";
import { resetBookingChatPersistedSession } from "@/features/ai-booking-chat";

interface SignInResult {
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<{ error: string | null; isUserAlreadyExists?: boolean }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
  sendVerificationOtp: (email: string) => Promise<{ error: string | null }>;
  verifyEmailOtp: (code: string) => Promise<{ error: string | null }>;
  sendRecoveryOtp: (email: string) => Promise<{ error: string | null }>;
  verifyRecoveryOtp: (email: string, code: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const hadAuthenticatedUserRef = useRef(false);

  const isUserAlreadyExistsError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("already") ||
      normalized.includes("exists") ||
      normalized.includes("already registered") ||
      normalized.includes("user already")
    );
  };

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      applySession(next);
      if (event === "INITIAL_SESSION") finishInit();
    });

    void supabase.auth
      .getSession()
      .then(async ({ data: { session: s }, error }) => {
        if (error) {
          if (isInvalidRefreshTokenError(error)) {
            // Recover from stale local token without hitting network sign-out endpoint.
            await supabase.auth.signOut({ scope: "local" });
            applySession(null);
            finishInit();
            return;
          }
          throw error;
        }
        applySession(s);
        finishInit();
      })
      .catch(async (error: unknown) => {
        if (isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut({ scope: "local" });
          applySession(null);
          finishInit();
          return;
        }
        const message = error instanceof Error ? error.message : "Unknown auth initialization error";
        devWarn("[auth] getSession failed:", message);
        applySession(null);
        finishInit();
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const register = () => {
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

  useEffect(() => {
    if (user?.id) {
      hadAuthenticatedUserRef.current = true;
      return;
    }
    if (!loading && hadAuthenticatedUserRef.current) {
      hadAuthenticatedUserRef.current = false;
      void clearSessionCaches(queryClient);
      void resetBookingChatPersistedSession();
    }
  }, [loading, queryClient, user?.id]);

  const signUp = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-signup", {
        body: {
          email,
          password,
          firstName,
          lastName,
          redirectTo: getEmailCallbackRedirectUrl(),
        },
      });
      if (error) {
        const message = error.message ?? "Sign up failed";
        return { error: message, isUserAlreadyExists: isUserAlreadyExistsError(message) };
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        const message = String(data.error);
        return { error: message, isUserAlreadyExists: isUserAlreadyExistsError(message) };
      }
      return { error: null };
    },
    [getEmailCallbackRedirectUrl],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    return { error: error.message ?? "Sign in failed" };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error && isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(
    async (email: string) => {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-recovery", {
        body: {
          email,
          redirectTo: getEmailCallbackRedirectUrl(),
        },
      });
      if (error) return { error: error.message };
      if (data && typeof data === "object" && "error" in data && data.error) return { error: String(data.error) };
      return { error: null };
    },
    [getEmailCallbackRedirectUrl],
  );

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, []);

  const sendVerificationOtp = useCallback(async (email: string) => {
    devInfo("[auth][sendVerificationOtp] invoke auth-email-verify", { email });
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-verify", {
      body: {
        email,
      },
    });
    if (error) {
      devError("[auth][sendVerificationOtp] edge invoke error:", error.message);
      return { error: error.message };
    }
    if (data && typeof data === "object" && "error" in data && data.error) {
      devError("[auth][sendVerificationOtp] edge response error:", String(data.error));
      return { error: String(data.error) };
    }
    devInfo("[auth][sendVerificationOtp] edge invoke success");
    return { error: null };
  }, []);

  const verifyEmailOtp = useCallback(async (code: string) => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-verify-otp", {
      body: { code },
    });
    if (error) return { error: error.message };
    if (data && typeof data === "object" && "error" in data && data.error) return { error: String(data.error) };
    return { error: null };
  }, []);

  const sendRecoveryOtp = useCallback(async (email: string) => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-recovery", {
      body: { action: "send", email },
    });
    if (error) return { error: error.message };
    if (data && typeof data === "object" && "error" in data && data.error) return { error: String(data.error) };
    return { error: null };
  }, []);

  const verifyRecoveryOtp = useCallback(async (email: string, code: string) => {
    const { data, error } = await supabase.functions.invoke<{
      ok: boolean;
      error?: string;
      session?: { access_token?: string; refresh_token?: string };
    }>("auth-email-recovery", {
      body: { action: "verify", email, code },
    });
    if (error) return { error: error.message };
    if (data && typeof data === "object" && "error" in data && data.error) return { error: String(data.error) };

    const accessToken = data?.session?.access_token;
    const refreshToken = data?.session?.refresh_token;
    if (!accessToken || !refreshToken) return { error: "Recovery session is missing" };

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setSessionError) return { error: setSessionError.message };
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
