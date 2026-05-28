export const PASSWORD_MASK_CHAR = "*";

/** Maps Android masked TextInput edits back to the real password string. */
export function resolveMaskedPasswordChange(
  nextText: string,
  prevPassword: string,
  pendingKey: string | null,
): string {
  if (nextText.length === 0) {
    return "";
  }

  if (nextText.length < prevPassword.length) {
    return prevPassword.slice(0, nextText.length);
  }

  if (nextText.length === prevPassword.length) {
    return prevPassword;
  }

  if (!nextText.includes(PASSWORD_MASK_CHAR)) {
    return nextText;
  }

  const appended = nextText.slice(prevPassword.length);
  const plainAppended = appended.replace(/\*/g, "");
  if (plainAppended.length > 0) {
    return prevPassword + plainAppended;
  }

  if (pendingKey && pendingKey.length === 1 && pendingKey !== "Backspace") {
    return prevPassword + pendingKey;
  }

  return prevPassword;
}

export function toMaskedPasswordDisplay(password: string): string {
  return PASSWORD_MASK_CHAR.repeat(password.length);
}
