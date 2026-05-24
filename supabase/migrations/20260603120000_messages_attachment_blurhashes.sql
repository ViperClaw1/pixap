-- BlurHash placeholders parallel to messages.attachments (same array order).

alter table if exists public.messages
  add column if not exists attachment_blurhashes jsonb;

comment on column public.messages.attachment_blurhashes is
  'JSON array of BlurHash strings parallel to attachments[]; null slots for non-image files.';
