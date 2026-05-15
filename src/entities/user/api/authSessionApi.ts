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
