import { useMutation } from "@tanstack/react-query";
import { sendEmailVerificationOtp, verifyEmailOtp } from "../api/emailVerificationOtp";

export function useSendEmailVerificationOtp() {
  return useMutation({
    mutationFn: sendEmailVerificationOtp,
  });
}

export function useVerifyEmailOtp() {
  return useMutation({
    mutationFn: verifyEmailOtp,
  });
}
