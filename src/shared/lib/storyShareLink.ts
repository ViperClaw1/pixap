import * as Linking from "expo-linking";
import { env } from "./env";

/** Native deep link (`pixap://story/{id}`) — opens FeedStoryViewer for the story when the app is installed. */
export function buildStoryShareUrl(storyId: string): string {
  const id = storyId.trim();
  if (!id) return `${env.stripeReturnScheme}://feed`;
  return Linking.createURL(`story/${id}`);
}

/** HTTPS universal link (for future web + App Links once hosted). */
export function buildStoryShareUniversalUrl(storyId: string): string {
  return `https://pixapp.kz/story/${encodeURIComponent(storyId.trim())}`;
}
