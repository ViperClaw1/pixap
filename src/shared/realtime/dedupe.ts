/** Returns true if an item with the same id already exists in the list. */
export function listHasId<T extends { id: string }>(items: readonly T[] | undefined, id: string): boolean {
  return items?.some((item) => item.id === id) ?? false;
}
