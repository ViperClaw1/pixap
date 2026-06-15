export type MessageThreadScrollSnapshot = {
  offsetY: number;
  wasAtBottom: boolean;
  showScrollFab: boolean;
};

const scrollMemory = new Map<string, MessageThreadScrollSnapshot>();
const visitedThreadIds = new Set<string>();

export function getMessageThreadScrollSnapshot(threadId: string): MessageThreadScrollSnapshot | undefined {
  return scrollMemory.get(threadId);
}

export function setMessageThreadScrollSnapshot(threadId: string, snapshot: MessageThreadScrollSnapshot) {
  scrollMemory.set(threadId, snapshot);
}

export function hasMessageThreadSessionVisit(threadId: string): boolean {
  return visitedThreadIds.has(threadId);
}

export function markMessageThreadSessionVisit(threadId: string) {
  visitedThreadIds.add(threadId);
}

export function shouldOpenMessageThreadAtBottom(threadId: string | null | undefined): boolean {
  if (!threadId) return true;
  const snapshot = getMessageThreadScrollSnapshot(threadId);
  return !snapshot || snapshot.wasAtBottom;
}
