export function profileFullName(first?: string | null, last?: string | null) {
  return `${first?.trim() ?? ""} ${last?.trim() ?? ""}`.trim() || "Unknown user";
}
