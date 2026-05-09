import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { supabase } from "@/shared/api/supabase/client";
import { env } from "@/shared/lib/env";
import { isInvalidRefreshTokenError } from "@/shared/lib/supabaseAuth";
import { registerNativePushToken } from "@/services/pushNotifications";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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
        if (__DEV__) {
          const message = error instanceof Error ? error.message : "Unknown auth initialization error";
          console.warn("[auth] getSession failed:", message);
        }
        applySession(null);
        finishInit();
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      void registerNativePushToken(user.id);
    }
  }, [user?.id]);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
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
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };
    return { error: error.message ?? "Sign in failed" };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && isInvalidRefreshTokenError(error)) {
      await supabase.auth.signOut({ scope: "local" });
      return;
    }
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-recovery", {
      body: {
        email,
        redirectTo: getEmailCallbackRedirectUrl(),
      },
    });
    if (error) return { error: error.message };
    if (data && typeof data === "object" && "error" in data && data.error) return { error: String(data.error) };
    return { error: null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const resendVerification = async (email: string) => {
    if (__DEV__) {
      console.info("[auth][resendVerification] invoke auth-email-verify", {
        email,
        redirectTo: getEmailCallbackRedirectUrl(),
      });
    }
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>("auth-email-verify", {
      body: {
        email,
        redirectTo: getEmailCallbackRedirectUrl(),
      },
    });
    if (error) {
      if (__DEV__) console.error("[auth][resendVerification] edge invoke error:", error.message);
      return { error: error.message };
    }
    if (data && typeof data === "object" && "error" in data && data.error) {
      if (__DEV__) console.error("[auth][resendVerification] edge response error:", String(data.error));
      return { error: String(data.error) };
    }
    if (__DEV__) console.info("[auth][resendVerification] edge invoke success");
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
      }}
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
