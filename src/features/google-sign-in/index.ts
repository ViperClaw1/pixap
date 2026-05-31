export { isNativeGoogleSignInAvailable } from "./lib/isNativeGoogleSignInAvailable";
export type { GoogleNativeSignInResult } from "./types";

/** Lazy-loads native Google Sign-In so Auth screen mounts without RNGoogleSignin in the binary. */
export async function signInWithGoogleNative(): Promise<import("./types").GoogleNativeSignInResult> {
  const { signInWithGoogleNative: run } = await import("./lib/signInWithGoogleNative");
  return run();
}
