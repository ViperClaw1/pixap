export const RESET_PASSWORD_RULE_KEYS = [
  "auth.ruleMinLength",
  "auth.ruleUppercase",
  "auth.ruleDigit",
  "auth.ruleSpecial",
] as const;

export const RESET_PASSWORD_COPY_KEYS = {
  title: "auth.passwordReset.title",
  hintLinkReceived: "auth.passwordReset.hintLinkReceived",
  hintChooseNew: "auth.passwordReset.hintChooseNew",
  btnUpdate: "auth.passwordReset.btnUpdate",
  alertTooShortTitle: "auth.passwordReset.alertTooShortTitle",
  alertTooShortBody: "auth.passwordReset.alertTooShortBody",
  alertWeakTitle: "auth.passwordReset.alertWeakTitle",
  alertMismatchTitle: "auth.passwordReset.alertMismatchTitle",
  passwordPolicyBody: "auth.alerts.passwordPolicy",
  passwordsMismatchBody: "auth.alerts.passwordsMismatch",
  toastUpdateFailedTitle: "auth.passwordReset.toastUpdateFailedTitle",
  toastUpdatedTitle: "auth.passwordReset.toastUpdatedTitle",
  toastUpdatedBody: "auth.passwordReset.toastUpdatedBody",
} as const;
