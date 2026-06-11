import { businessCardStorageObjectPath } from "@/shared/lib/business-card/businessCardPregenStorage";

const USER_VENUE_UPLOAD_PATH_RE = /^[0-9a-f-]{36}\/venue-\d{13}-/i;

export function isUserOwnedBusinessCardImageUrl(
  imageUrl: string,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  const objectPath = businessCardStorageObjectPath(imageUrl);
  if (!objectPath) return false;
  if (!objectPath.startsWith(`${userId}/`)) return false;
  return USER_VENUE_UPLOAD_PATH_RE.test(objectPath);
}
