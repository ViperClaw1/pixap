import { createContext, useContext, type ReactNode } from "react";
import type { AppPopupState } from "./types";

export type AppPopupContextValue = {
  state: AppPopupState;
  hide: () => void;
};

export const AppPopupContext = createContext<AppPopupContextValue | null>(null);

export function useAppPopupContext() {
  const ctx = useContext(AppPopupContext);
  if (!ctx) {
    throw new Error("useAppPopupContext must be used within AppPopupProvider");
  }
  return ctx;
}

export function AppPopupContextProvider({
  value,
  children,
}: {
  value: AppPopupContextValue;
  children: ReactNode;
}) {
  return <AppPopupContext.Provider value={value}>{children}</AppPopupContext.Provider>;
}
