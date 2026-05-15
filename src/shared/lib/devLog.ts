type DevLogFn = (...args: unknown[]) => void;

const noop: DevLogFn = () => {};

function bindDevLog(method: "log" | "info" | "warn" | "error"): DevLogFn {
  if (!__DEV__) return noop;
  return (...args: unknown[]) => {
    console[method](...args);
  };
}

/** Dev-only logging — no-ops in production builds. */
export const devLog = bindDevLog("log");
export const devInfo = bindDevLog("info");
export const devWarn = bindDevLog("warn");
export const devError = bindDevLog("error");
