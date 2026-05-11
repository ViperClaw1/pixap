export type SendEmailVerificationOtpPayload = {
  email: string;
};

export type SendEmailVerificationOtpResponse = {
  ok: boolean;
  expiresInMinutes?: number;
  error?: string;
};

export type VerifyEmailOtpPayload = {
  code: string;
};

export type VerifyEmailOtpResponse = {
  ok: boolean;
  error?: string;
};
