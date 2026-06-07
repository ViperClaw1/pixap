const CATEGORY_ACCENT: Record<string, string> = {
  restaurants: "#e85d04",
  bars: "#7209b7",
  clubs: "#3a0ca3",
  tourism: "#0077b6",
  entertainment: "#f72585",
  events: "#ff6b35",
  beauty: "#ff85a1",
  hotels: "#2a9d8f",
};

export function categoryAccentColor(categoryName: string): string {
  const key = categoryName.trim().toLowerCase();
  return CATEGORY_ACCENT[key] ?? "#6366f1";
}
