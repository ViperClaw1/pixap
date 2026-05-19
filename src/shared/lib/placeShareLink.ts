import * as Linking from "expo-linking";
import { env } from "./env";

/** Native deep link (`pixap://place/{id}`) — opens PlaceDetail when the app is installed. */
export function buildPlaceShareUrl(placeId: string): string {
  const id = placeId.trim();
  if (!id) return `${env.stripeReturnScheme}://`;
  return Linking.createURL(`place/${id}`);
}

/** HTTPS universal link (for future web + App Links once hosted). */
export function buildPlaceShareUniversalUrl(placeId: string): string {
  return `https://pixapp.kz/place/${encodeURIComponent(placeId.trim())}`;
}
