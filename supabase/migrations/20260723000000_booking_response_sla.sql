-- Fixed venue response SLA for automated booking outreach.

alter table public.cart_items
  add column if not exists response_deadline_at timestamptz null,
  add column if not exists response_timed_out_at timestamptz null;

create index if not exists cart_items_response_deadline_pending_idx
  on public.cart_items (response_deadline_at)
  where status = 'created'
    and wa_confirmable = false
    and response_timed_out_at is null
    and response_deadline_at is not null;

comment on column public.cart_items.response_deadline_at is
  'Fixed deadline for venue response after automated outreach starts.';

comment on column public.cart_items.response_timed_out_at is
  'Set when the venue did not respond before response_deadline_at.';
