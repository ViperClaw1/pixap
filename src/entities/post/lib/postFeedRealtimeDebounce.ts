const timers = new Map<string, ReturnType<typeof setTimeout>>();

const DEBOUNCE_MS = 300;

export function debouncedPostsFeedInvalidate(key: string, fn: () => void): void {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      fn();
    }, DEBOUNCE_MS),
  );
}
