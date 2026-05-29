-- Server-side AI data transfer consent (Google Gemini) per user.
-- Reset for QA: UPDATE profiles SET ai_data_consent_at = NULL, ai_data_consent_declined_at = NULL WHERE id = '<user_id>';

alter table public.profiles
  add column if not exists ai_data_consent_at timestamptz,
  add column if not exists ai_data_consent_declined_at timestamptz;

comment on column public.profiles.ai_data_consent_at is
  'When the user granted consent to send booking/chat data to the AI provider (Google Gemini).';
comment on column public.profiles.ai_data_consent_declined_at is
  'When the user declined AI data transfer consent before granting.';

create or replace function public.grant_ai_data_consent()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set ai_data_consent_at = now(),
      ai_data_consent_declined_at = null,
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.decline_ai_data_consent()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set ai_data_consent_declined_at = coalesce(ai_data_consent_declined_at, now()),
      updated_at = now()
  where id = auth.uid()
    and ai_data_consent_at is null;
end;
$$;

grant execute on function public.grant_ai_data_consent() to authenticated;
grant execute on function public.decline_ai_data_consent() to authenticated;
