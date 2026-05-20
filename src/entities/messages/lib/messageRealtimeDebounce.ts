const DEBOUNCE_MS = 300;

type DebouncedFn = () => void;

const inboxTimers = new Map<string, ReturnType<typeof setTimeout>>();
const threadTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedule(map: Map<string, ReturnType<typeof setTimeout>>, key: string, fn: DebouncedFn) {
  const existing = map.get(key);
  if (existing) clearTimeout(existing);
  map.set(
    key,
    setTimeout(() => {
      map.delete(key);
      fn();
    }, DEBOUNCE_MS),
  );
}

export function debouncedInboxInvalidate(key: string, fn: DebouncedFn) {
  schedule(inboxTimers, key, fn);
}

export function debouncedThreadInvalidate(threadId: string, fn: DebouncedFn) {
  schedule(threadTimers, threadId, fn);
}

export function clearMessageRealtimeDebounce() {
  for (const t of inboxTimers.values()) clearTimeout(t);
  for (const t of threadTimers.values()) clearTimeout(t);
  inboxTimers.clear();
  threadTimers.clear();
}
