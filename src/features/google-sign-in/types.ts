export type GoogleNativeSignInResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };
