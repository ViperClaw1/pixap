-- Preference onboarding: city selection is the first step for new users.
alter table public.user_preferences
  alter column onboarding_step set default 'city_selection';
