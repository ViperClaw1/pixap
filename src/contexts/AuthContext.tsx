import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { env } from "@/lib/env";
import { registerNativePushToken } from "@/services/pushNotifications";

interface SignInResult {
  error: string | null;
  isUnverified?: boolean;
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
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
  /** Supabase email confirmation / magic links */
  getEmailRedirectBase: () => string;
  getPasswordResetRedirectUrl: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const getEmailRedirectBase = useCallback(() => env.oauthRedirectBase.replace(/\/$/, ""), []);
  const getPasswordResetRedirectUrl = useCallback(
    () => `${getEmailRedirectBase()}/reset-password`,
    [getEmailRedirectBase],
  );

  useEffect(() => {
    let active = true;

    const isInvalidRefreshTokenError = (error: unknown) => {
      if (!(error instanceof Error)) return false;
      const message = error.message.toLowerCase();
      return (
        message.includes("invalid refresh token") ||
        message.includes("refresh token not found") ||
        message.includes("jwt expired")
      );
    };

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: getEmailRedirectBase(),
      },
    });

    if (error) return { error: error.message };

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { error: "User already registered" };
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) return { error: null };

    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("email not confirmed")) {
      return { error: msg, isUnverified: true };
    }

    return { error: msg };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const resendVerification = async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error?.message ?? null };
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
        getEmailRedirectBase,
        getPasswordResetRedirectUrl,
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
