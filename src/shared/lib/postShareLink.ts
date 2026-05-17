import * as Linking from "expo-linking";
import { env } from "./env";

/**
 * Native deep link (`pixap://post/{id}`) — opens PostDetail when the app is installed.
 * `https://pixapp.kz/post/...` needs AASA/assetlinks + a web route; the site currently returns 404.
 */
export function buildPostShareUrl(postId: string): string {
  const id = postId.trim();
  if (!id) return `${env.stripeReturnScheme}://feed`;
  return Linking.createURL(`post/${id}`);
}

/** HTTPS universal link (for future web + App Links once hosted). */
export function buildPostShareUniversalUrl(postId: string): string {
  return `https://pixapp.kz/post/${encodeURIComponent(postId.trim())}`;
}
