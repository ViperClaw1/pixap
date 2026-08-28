export type PixaiCreditsPayload = {
  balance: number | null;
  charged: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parsePixaiCreditsPayload(raw: unknown): PixaiCreditsPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const charged = toFiniteNumber(row.charged);
  if (charged == null || charged < 0) return null;
  const balanceRaw = toFiniteNumber(row.balance);
  const balance = balanceRaw != null && balanceRaw >= 0 ? balanceRaw : null;
  return { balance, charged };
}

export function parsePixaiCreditsFromResponse(data: unknown): PixaiCreditsPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return parsePixaiCreditsPayload((data as Record<string, unknown>).credits);
}
