import { LAST_SEEN_ONLINE_THRESHOLD_MS } from "@/entities/user-presence";
import { formatRelativeLastSeen } from "./format";

export type PeerPresenceStatus = {
  isOnline: boolean;
  label: string;
};

function isRecentlyActive(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  const ms = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= LAST_SEEN_ONLINE_THRESHOLD_MS;
}

export function resolvePeerPresenceStatus(params: {
  peerIsTyping: boolean;
  peerIsOnline: boolean;
  peerLastSeenAt: string | null;
  typingLabel: string;
  onlineLabel: string;
}): PeerPresenceStatus {
  if (params.peerIsTyping) {
    return { isOnline: true, label: params.typingLabel };
  }
  if (params.peerIsOnline) {
    return { isOnline: true, label: params.onlineLabel };
  }

  const lastSeenAt = params.peerLastSeenAt;
  if (isRecentlyActive(lastSeenAt)) {
    return { isOnline: true, label: params.onlineLabel };
  }

  return {
    isOnline: false,
    label: formatRelativeLastSeen(lastSeenAt),
  };
}
