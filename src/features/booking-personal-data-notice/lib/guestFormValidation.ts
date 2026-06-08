export type GuestFormFieldError = "partySize" | "name" | "phone" | "email";

export function isPersonalDataFormFieldError(error: GuestFormFieldError): boolean {
  return error === "name" || error === "phone";
}
