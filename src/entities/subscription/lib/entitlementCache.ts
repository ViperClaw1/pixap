import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SubscriptionEntitlement } from "../api/useEntitlement";

const KEY_PREFIX = "@pixap/subscription_entitlement_v1";
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["active", "trialing", "grace_period", "billing_retry"]);

type CachedEntitlement = {
  userId: string;
  entitlement: SubscriptionEntitlement;
  cachedAt: number;
};

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

function isUsableCachedEntitlement(cache: CachedEntitlement, now = Date.now()): boolean {
  if (cache.userId !== cache.entitlement.user_id) return false;
  if (!ACTIVE_STATUSES.has(cache.entitlement.status)) return false;
  if (now - cache.cachedAt > OFFLINE_GRACE_MS) return false;

  const expiresAtMs = cache.entitlement.expires_at ? new Date(cache.entitlement.expires_at).getTime() : Number.NaN;
  if (Number.isFinite(expiresAtMs) && now > expiresAtMs + OFFLINE_GRACE_MS) return false;

  return true;
}

export async function readCachedEntitlement(userId: string): Promise<SubscriptionEntitlement | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const cache = JSON.parse(raw) as CachedEntitlement;
    return isUsableCachedEntitlement(cache) ? cache.entitlement : null;
  } catch {
    return null;
  }
}

export async function writeCachedEntitlement(userId: string, entitlement: SubscriptionEntitlement | null): Promise<void> {
  try {
    if (!entitlement || !ACTIVE_STATUSES.has(entitlement.status)) {
      await AsyncStorage.removeItem(storageKey(userId));
      return;
    }
    const cache: CachedEntitlement = {
      userId,
      entitlement,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(cache));
  } catch {
    // Cache failures must never break entitlement hydration.
  }
}
