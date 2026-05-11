create table if not exists public.email_verification_otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists email_verification_otp_codes_active_user_idx
  on public.email_verification_otp_codes (user_id)
  where used_at is null;

create index if not exists email_verification_otp_codes_email_idx
  on public.email_verification_otp_codes (email);

create index if not exists email_verification_otp_codes_expires_at_idx
  on public.email_verification_otp_codes (expires_at);

alter table public.email_verification_otp_codes enable row level security;

revoke all on table public.email_verification_otp_codes from anon, authenticated;
