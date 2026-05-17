import type { AppPopupOptions, AppPopupVariant } from "./types";

type ShowHandler = (options: AppPopupOptions) => void;
type HideHandler = () => void;

let showHandler: ShowHandler | null = null;
let hideHandler: HideHandler | null = null;

export function registerAppPopupHandlers(handlers: { show: ShowHandler; hide: HideHandler }) {
  showHandler = handlers.show;
  hideHandler = handlers.hide;
}

export function unregisterAppPopupHandlers() {
  showHandler = null;
  hideHandler = null;
}

export function showAppPopup(options: AppPopupOptions) {
  if (!showHandler) {
    if (__DEV__) {
      console.warn("[AppPopup] showAppPopup called before AppPopupProvider mounted");
    }
    return;
  }
  showHandler(options);
}

export function hideAppPopup() {
  hideHandler?.();
}

/** Drop-in helper for simple alerts (title, optional message, optional buttons). */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AppPopupOptions["buttons"],
  variant?: AppPopupVariant,
) {
  showAppPopup({
    title,
    message: message?.trim() || undefined,
    buttons: buttons?.length ? buttons : [{ text: "OK" }],
    variant,
  });
}
