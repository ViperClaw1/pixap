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
  /** Brand CTA (orange) — auth, follow, main actions */
  accent: string;
  onAccent: string;
  shadow: string;
  /** Tag pills on cards / search rows */
  tagMuted: string;
  tagMutedText: string;
  /** Buttons over photos (place hero, gallery) */
  mediaOverlay: string;
  mediaOverlayText: string;
  accentSurface: string;
  /** Secondary dark action (e.g. chat swipe) */
  actionMuted: string;
  successSurface: string;
  dangerSurface: string;
  dangerSurfaceStrong: string;
  scrim: string;
  heroDot: string;
  heroDotActive: string;
  warningBorder: string;
  messageBubblePeer: string;
  messageMetaOnAccent: string;
  messageMetaOnPeer: string;
};

const accent = "#ec6544";
const onAccent = "#ffffff";

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
  accent,
  onAccent,
  shadow: "#000000",
  tagMuted: "#f4f4f5",
  tagMutedText: "#27272a",
  mediaOverlay: "rgba(255,255,255,0.92)",
  mediaOverlayText: "#111111",
  accentSurface: "rgba(236,101,68,0.14)",
  actionMuted: "#333333",
  successSurface: "rgba(34,197,94,0.15)",
  dangerSurface: "rgba(239,68,68,0.12)",
  dangerSurfaceStrong: "rgba(239,68,68,0.08)",
  scrim: "rgba(0,0,0,0.6)",
  heroDot: "rgba(255,255,255,0.45)",
  heroDotActive: "rgba(255,255,255,0.95)",
  warningBorder: "#c45c26",
  messageBubblePeer: "#f3f6ff",
  messageMetaOnAccent: "rgba(255,255,255,0.72)",
  messageMetaOnPeer: "rgba(17,24,39,0.48)",
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
  accent: "#ff7a59",
  onAccent: "#ffffff",
  shadow: "#000000",
  tagMuted: "#0d0d0f",
  tagMutedText: "#e8e8ea",
  mediaOverlay: "rgba(0,0,0,0.55)",
  mediaOverlayText: "#f5f5f5",
  accentSurface: "rgba(255,122,89,0.2)",
  actionMuted: "#2a2a2a",
  successSurface: "rgba(34,197,94,0.2)",
  dangerSurface: "rgba(248,113,113,0.18)",
  dangerSurfaceStrong: "rgba(248,113,113,0.12)",
  scrim: "rgba(0,0,0,0.75)",
  heroDot: "rgba(255,255,255,0.4)",
  heroDotActive: "rgba(255,255,255,0.92)",
  warningBorder: "#e07a45",
  messageBubblePeer: "#1f2230",
  messageMetaOnAccent: "rgba(17,24,39,0.78)",
  messageMetaOnPeer: "rgba(255,255,255,0.52)",
};
