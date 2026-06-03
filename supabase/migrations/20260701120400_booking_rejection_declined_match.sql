-- Treat wa-booking-service decline status lines as venue rejection.

create or replace function private.wa_status_indicates_rejection(p_lines jsonb)
returns boolean
language sql
immutable
as $$
  select private.wa_status_lines_text(p_lines) ~ '(not available|unavailable|slot is not available|declin|недоступен|отклон|reject)';
$$;
