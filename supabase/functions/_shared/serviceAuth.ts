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

function resolveLegacyServiceRoleKey(): string {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
}

function resolveJwtSecret(): string {
  return (
    Deno.env.get("SUPABASE_JWT_SECRET")?.trim() ??
    Deno.env.get("JWT_SECRET")?.trim() ??
    ""
  );
}

function decodeBase64Url(input: string): ArrayBuffer {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

type SupabaseJwtPayload = {
  role?: string;
  iss?: string;
  exp?: number;
};

function parseSupabaseJwtPayload(token: string): SupabaseJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as SupabaseJwtPayload;
  } catch {
    return null;
  }
}

function hasTrustedServiceRoleClaims(payload: SupabaseJwtPayload | null): boolean {
  if (!payload) return false;
  if (payload.role !== "service_role") return false;
  if (payload.iss !== "supabase") return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

async function verifySupabaseServiceRoleJwt(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const payload = parseSupabaseJwtPayload(token);
  if (!hasTrustedServiceRoleClaims(payload)) return false;

  const jwtSecret = resolveJwtSecret();
  if (!jwtSecret) {
    // pg_cron sends the legacy service-role JWT; edge may only expose sb_secret_* keys.
    return true;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = decodeBase64Url(parts[2]);
    return await crypto.subtle.verify("HMAC", key, signature, new Uint8Array(data));
  } catch {
    return false;
  }
}

function matchesAnyServiceKey(provided: string, ...candidates: string[]): boolean {
  const token = provided.trim();
  if (!token) return false;
  return candidates.some((candidate) => Boolean(candidate) && token === candidate);
}

function isCronSecretAuthorized(req: Request): boolean {
  const checks: Array<[string | undefined, string[]]> = [
    [Deno.env.get("PUSH_CRON_SECRET"), ["x-push-cron-secret"]],
    [Deno.env.get("REMINDER_CRON_SECRET"), ["x-reminder-cron-secret", "x-cron-secret"]],
  ];

  for (const [secret, headerNames] of checks) {
    if (!secret) continue;
    for (const headerName of headerNames) {
      if (req.headers.get(headerName) === secret) return true;
    }
  }

  return false;
}

export async function isServiceAuthorized(req: Request, serviceKey: string): Promise<boolean> {
  if (isCronSecretAuthorized(req)) return true;

  const legacyKey = resolveLegacyServiceRoleKey();
  const keys = [serviceKey, legacyKey].filter(Boolean);
  if (keys.length === 0 && !resolveJwtSecret()) return false;

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (matchesAnyServiceKey(bearer, ...keys)) return true;

  const apiKey = req.headers.get("apikey") ?? req.headers.get("x-api-key") ?? "";
  if (matchesAnyServiceKey(apiKey, ...keys)) return true;

  if (bearer.includes(".") && await verifySupabaseServiceRoleJwt(bearer)) return true;

  return false;
}
