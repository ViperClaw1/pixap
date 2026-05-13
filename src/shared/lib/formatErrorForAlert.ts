/** Best-effort message for Alert() when catch value is not always `Error`. */
export function formatErrorForAlert(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const rec = error as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim().length > 0) {
      return rec.message;
    }
    if (typeof rec.error_description === "string" && rec.error_description.trim().length > 0) {
      return rec.error_description;
    }
    if (typeof rec.hint === "string" && rec.hint.trim().length > 0) {
      return rec.hint;
    }
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
