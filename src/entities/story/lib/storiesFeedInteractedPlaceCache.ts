const interactedPlaceIdsByUser = new Map<string, string[]>();

export function getStoriesFeedInteractedPlaceCache(userId: string): string[] | undefined {
  return interactedPlaceIdsByUser.get(userId);
}

export function setStoriesFeedInteractedPlaceCache(userId: string, placeIds: string[]) {
  interactedPlaceIdsByUser.set(userId, placeIds);
}

export function clearStoriesFeedInteractedPlaceCache(userId?: string) {
  if (userId) interactedPlaceIdsByUser.delete(userId);
  else interactedPlaceIdsByUser.clear();
}
