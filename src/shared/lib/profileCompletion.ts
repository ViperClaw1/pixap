import type { Profile } from "@/entities/user";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Minimum profile fields required before booking flows (AI booking, booking flow, vibe match). */
export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return (
    hasText(profile.username) &&
    hasText(profile.first_name) &&
    hasText(profile.last_name) &&
    hasText(profile.phone)
  );
}

