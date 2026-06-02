import { supabase } from "@/shared/api/supabase/client";

export async function waitForAuthUserId(maxAttempts = 15, delayMs = 120): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token && session.user?.id) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user?.id) return data.user.id;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** Wait for authenticated user via auth state events (faster than polling getUser). */
export function waitForAuthUserIdFromAuthState(timeoutMs = 10_000): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const finish = (userId: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
      resolve(userId);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        finish(session.user.id);
      }
    });

    const timeout = setTimeout(() => finish(null), timeoutMs);

    subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED") return;
      const userId = session?.user?.id;
      if (userId) finish(userId);
    }).data.subscription;
  });
}
