import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/entities/user";
import { isAppleAuthUser } from "@/shared/lib/auth/isAppleAuthUser";

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** First name saved in profile (last_name and phone are optional since EditProfile no longer requires them). */
export function isPersonalDataComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return hasText(profile.first_name);
}

/** Minimum profile fields required before booking flows (AI booking, booking flow, vibe match). */
export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return hasText(profile.username) && hasText(profile.first_name);
}

/** Apple sign-in users with missing name or phone should see the booking profile notice. */
export function shouldShowBookingPersonalDataNotice(
  user: User | null | undefined,
  profile: Profile | null | undefined,
): boolean {
  return isAppleAuthUser(user) && !isPersonalDataComplete(profile);
}

