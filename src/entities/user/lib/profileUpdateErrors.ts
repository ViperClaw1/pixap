export function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }
  return "Something went wrong. Please try again.";
}

function getSupabaseErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return code != null ? String(code) : undefined;
  }
  return undefined;
}

export function mapProfileUpdateErrorMessage(message: string, code?: string): string {
  const lower = message.toLowerCase();
  if (
    code === "23505" ||
    lower.includes("profiles_username_unique_idx") ||
    (lower.includes("duplicate key") && lower.includes("username"))
  ) {
    return "This username is already taken. Please choose another one.";
  }
  return message;
}

export function toProfileUpdateError(error: unknown): Error {
  const code = getSupabaseErrorCode(error);
  const message = mapProfileUpdateErrorMessage(getSupabaseErrorMessage(error), code);
  return new Error(message);
}

export function isUsernameTakenError(error: unknown): boolean {
  const code = getSupabaseErrorCode(error);
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return (
    code === "23505" ||
    message.includes("profiles_username_unique_idx") ||
    (message.includes("duplicate key") && message.includes("username"))
  );
}
