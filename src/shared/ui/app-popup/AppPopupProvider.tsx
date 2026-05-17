import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppPopupContextProvider } from "./AppPopupContext";
import { registerAppPopupHandlers, unregisterAppPopupHandlers } from "./appPopupController";
import type { AppPopupOptions, AppPopupState } from "./types";

const INITIAL: AppPopupState = {
  visible: false,
  title: "",
  message: undefined,
  buttons: undefined,
  variant: undefined,
};

export function AppPopupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppPopupState>(INITIAL);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const show = useCallback((options: AppPopupOptions) => {
    setState({
      visible: true,
      title: options.title,
      message: options.message,
      buttons: options.buttons,
      variant: options.variant,
    });
  }, []);

  useEffect(() => {
    registerAppPopupHandlers({ show, hide });
    return () => unregisterAppPopupHandlers();
  }, [hide, show]);

  const contextValue = useMemo(() => ({ state, hide }), [hide, state]);

  return <AppPopupContextProvider value={contextValue}>{children}</AppPopupContextProvider>;
}
