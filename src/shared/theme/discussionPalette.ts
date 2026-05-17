/** Instagram-style discussion UI colors (full-screen page + inline threads). */
export type DiscussionUiPalette = {
  screenBg: string;
  text: string;
  textMuted: string;
  inputBg: string;
  footerBg: string;
  footerBorder: string;
  avatarFallback: string;
  grabber: string;
  /** Filled heart; outline uses `text` */
  likeAccent: string;
  sendAccent: string;
};

export const discussionPaletteDark: DiscussionUiPalette = {
  screenBg: "#121212",
  text: "#FFFFFF",
  textMuted: "#A8A8A8",
  inputBg: "#262626",
  footerBg: "#121212",
  footerBorder: "rgba(255,255,255,0.1)",
  avatarFallback: "#333333",
  grabber: "rgba(255,255,255,0.24)",
  likeAccent: "#F4212E",
  sendAccent: "#ec6544",
};

export const discussionPaletteLight: DiscussionUiPalette = {
  screenBg: "#FFFFFF",
  text: "#111111",
  textMuted: "rgba(17,17,17,0.55)",
  inputBg: "#F2F2F7",
  footerBg: "#FFFFFF",
  footerBorder: "rgba(0,0,0,0.08)",
  avatarFallback: "#E8E8ED",
  grabber: "rgba(0,0,0,0.22)",
  likeAccent: "#F4212E",
  sendAccent: "#ec6544",
};
