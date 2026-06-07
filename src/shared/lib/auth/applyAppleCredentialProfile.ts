import type * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "@/shared/api/supabase/client";
import { devError, devInfo } from "@/shared/lib/devLog";

type AppleFullName = AppleAuthentication.AppleAuthenticationFullName | null;

function normalizeNamePart(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function parseAppleFullName(fullName: AppleFullName): { firstName: string; lastName: string } {
  return {
    firstName: normalizeNamePart(fullName?.givenName),
    lastName: normalizeNamePart(fullName?.familyName),
  };
}

/** Persists Apple-provided name from the first native sign-in (Apple sends fullName only once). */
export async function applyAppleCredentialProfile(
  credential: Pick<AppleAuthentication.AppleAuthenticationCredential, "fullName">,
): Promise<void> {
  const { firstName, lastName } = parseAppleFullName(credential.fullName ?? null);
  if (!firstName && !lastName) {
    devInfo("[Apple] no fullName in credential (returning user or hidden name)");
    return;
  }

  const metadata: Record<string, string> = {};
  if (firstName) metadata.first_name = firstName;
  if (lastName) metadata.last_name = lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  if (fullName) metadata.full_name = fullName;

  const { error: metadataError } = await supabase.auth.updateUser({ data: metadata });
  if (metadataError) {
    devError("[Apple] updateUser metadata failed:", metadataError.message);
  } else {
    devInfo("[Apple] user metadata updated from credential");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return;

  const { data: existing, error: profileSelectError } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileSelectError) {
    devError("[Apple] profile lookup failed:", profileSelectError.message);
    return;
  }

  const profileUpdates: Record<string, string> = {};
  if (firstName && !normalizeNamePart(existing?.first_name)) {
    profileUpdates.first_name = firstName;
  }
  if (lastName && !normalizeNamePart(existing?.last_name)) {
    profileUpdates.last_name = lastName;
  }

  if (Object.keys(profileUpdates).length === 0) {
    devInfo("[Apple] profile already has name");
    return;
  }

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update(profileUpdates)
    .eq("id", user.id);

  if (profileUpdateError) {
    devError("[Apple] profile update failed:", profileUpdateError.message);
  } else {
    devInfo("[Apple] profile updated from credential");
  }
}
