import type { Profile } from "@/entities/user";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return (
    hasText(profile.first_name) &&
    hasText(profile.last_name) &&
    hasText(profile.phone) &&
    hasText(profile.bio) &&
    hasText(profile.avatar_url)
  );
}

