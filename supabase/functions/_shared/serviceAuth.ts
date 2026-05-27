export function resolveSupabaseSecretKey(): string {
  const single = Deno.env.get("SUPABASE_SECRET_KEY")?.trim();
  if (single) return single;

  const pluralRaw = Deno.env.get("SUPABASE_SECRET_KEYS")?.trim();
  if (pluralRaw) {
    try {
      const parsed = JSON.parse(pluralRaw) as Record<string, string>;
      const preferred = parsed.default ?? parsed.service ?? Object.values(parsed)[0];
      if (preferred?.trim()) return preferred.trim();
    } catch {
      // ignore malformed JSON and fall back to legacy env
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
}

export function isServiceAuthorized(req: Request, serviceKey: string): boolean {
  const cronSecret = Deno.env.get("PUSH_CRON_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-push-cron-secret") ?? "";
    if (provided === cronSecret) return true;
  }

  if (!serviceKey) return false;

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (bearer && bearer === serviceKey) return true;

  const apiKey = req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "";
  return Boolean(apiKey && apiKey === serviceKey);
}
