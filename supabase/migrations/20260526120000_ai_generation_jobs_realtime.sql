-- Async AI generation jobs with Realtime progress (client subscribes by user_id).

create table if not exists public.ai_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  result jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_generation_jobs_user_updated_idx
  on public.ai_generation_jobs (user_id, updated_at desc);

alter table public.ai_generation_jobs enable row level security;

create policy ai_generation_jobs_select_own
  on public.ai_generation_jobs
  for select
  to authenticated
  using (user_id = auth.uid());

create policy ai_generation_jobs_insert_own
  on public.ai_generation_jobs
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy ai_generation_jobs_update_own
  on public.ai_generation_jobs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.ai_generation_jobs replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'ai_generation_jobs'
    ) then
      alter publication supabase_realtime add table public.ai_generation_jobs;
    end if;
  end if;
end $$;
