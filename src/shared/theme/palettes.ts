export type ThemeColors = {
  background: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  /** Contrast text on `primary` buttons */
  onPrimary: string;
  tabBar: string;
  tabActive: string;
  tabInactive: string;
  notification: string;
  danger: string;
  link: string;
};

export const lightColors: ThemeColors = {
  background: "#fafafa",
  surface: "#ffffff",
  card: "#ffffff",
  text: "#111111",
  textMuted: "#666666",
  border: "#eeeeee",
  primary: "#111111",
  onPrimary: "#ffffff",
  tabBar: "#ffffff",
  tabActive: "#111111",
  tabInactive: "#888888",
  notification: "#2563eb",
  danger: "#cc0000",
  link: "#2563eb",
};

export const darkColors: ThemeColors = {
  background: "#0a0a0a",
  surface: "#141414",
  card: "#1a1a1a",
  text: "#f5f5f5",
  textMuted: "#a3a3a3",
  border: "#2a2a2a",
  primary: "#f5f5f5",
  onPrimary: "#111111",
  tabBar: "#111111",
  tabActive: "#f5f5f5",
  tabInactive: "#737373",
  notification: "#60a5fa",
  danger: "#f87171",
  link: "#60a5fa",
};
