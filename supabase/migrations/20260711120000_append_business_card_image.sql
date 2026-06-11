-- Allow authenticated users to append a venue photo URL to business_cards.images.

create or replace function public.append_business_card_image(
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
  v_images text[];
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_trimmed := btrim(p_image_url);
  if v_trimmed = '' then
    raise exception 'image url is required';
  end if;

  if not exists (select 1 from public.business_cards bc where bc.id = p_venue_id) then
    raise exception 'venue not found';
  end if;

  update public.business_cards
  set images = case
    when v_trimmed = any(images) then images
    else array_append(images, v_trimmed)
  end
  where id = p_venue_id
  returning images into v_images;

  return v_images;
end;
$$;

revoke all on function public.append_business_card_image(uuid, text) from public;
grant execute on function public.append_business_card_image(uuid, text) to authenticated;
