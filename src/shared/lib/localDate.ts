/** YYYY-MM-DD in the device local timezone (matches synced profile.timezone when the app is open). */
export function todayLocalYmd(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
