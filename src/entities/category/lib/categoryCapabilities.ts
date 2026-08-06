const NON_BOOKABLE_CATEGORY_NAMES = new Set(["tourism"]);

export function isCategoryBookingAllowed(name: string | null | undefined): boolean {
  if (!name) return true;
  return !NON_BOOKABLE_CATEGORY_NAMES.has(name.trim().toLowerCase());
}
