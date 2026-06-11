-- Remove a user-uploaded venue image from business_cards.images (owner folder only).

create or replace function public.remove_business_card_image(
  p_venue_id uuid,
  p_image_url text
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trimmed text;
  v_owner text;
  v_images text[];
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_owner := auth.uid()::text;
  v_trimmed := btrim(p_image_url);
  if v_trimmed = '' then
    raise exception 'image url is required';
  end if;

  if v_trimmed !~ ('/' || v_owner || '/venue-[0-9]{13}-') then
    raise exception 'not allowed to remove this image';
  end if;

  if not exists (select 1 from public.business_cards bc where bc.id = p_venue_id) then
    raise exception 'venue not found';
  end if;

  update public.business_cards
  set images = coalesce(array_remove(images, v_trimmed), '{}'::text[])
  where id = p_venue_id
    and v_trimmed = any(images)
  returning images into v_images;

  if v_images is null then
    raise exception 'image not found on venue';
  end if;

  return v_images;
end;
$$;

revoke all on function public.remove_business_card_image(uuid, text) from public;
grant execute on function public.remove_business_card_image(uuid, text) to authenticated;
