export const CALENDAR_MONTHS_AHEAD = 6;
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type CalendarCell = { kind: "pad" } | { kind: "day"; ymd: string; day: number };

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function monthKey(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

export function firstOfMonthContaining(d: Date): Date {
  const x = startOfLocalDay(d);
  return new Date(x.getFullYear(), x.getMonth(), 1);
}

export function buildMonthCells(year: number, month: number): CalendarCell[] {
  const lead = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ kind: "pad" });
  for (let d = 1; d <= dim; d++) {
    cells.push({ kind: "day", day: d, ymd: toYmd(new Date(year, month, d)) });
  }
  while (cells.length % 7 !== 0) cells.push({ kind: "pad" });
  return cells;
}

export function chunkCells<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
