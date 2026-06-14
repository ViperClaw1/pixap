type Listener = () => void;

let navigationReady = false;
let navigationReadyAt = 0;
const listeners = new Set<Listener>();

export function markAppNavigationReady(): void {
  if (navigationReady) return;
  navigationReady = true;
  navigationReadyAt = Date.now();
  for (const listener of listeners) {
    listener();
  }
  listeners.clear();
}

export function isAppNavigationReady(): boolean {
  return navigationReady;
}

export function getAppNavigationReadyAt(): number {
  return navigationReadyAt;
}

export function onAppNavigationReady(listener: Listener): () => void {
  if (navigationReady) {
    listener();
    return () => undefined;
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
