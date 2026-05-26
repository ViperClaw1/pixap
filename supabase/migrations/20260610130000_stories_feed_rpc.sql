-- Stories feed: server-side affinity scoring + stable cursor pagination (one round-trip per page).

create index if not exists stories_expiry_created_id_idx
  on public.stories (expiry_time, created_at desc, id desc);

create or replace function public.get_stories_feed_page(
  p_limit integer default 12,
  p_cursor_score smallint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 50));
  v_uid uuid := auth.uid();
  v_has_more boolean := false;
  v_stories jsonb := '[]'::jsonb;
  v_next_cursor jsonb := null;
begin
  with interacted_places as (
    select distinct s.place_id
    from public.stories s
    where v_uid is not null
      and s.place_id is not null
      and (
        s.user_id = v_uid
        or s.id in (
          select sr.story_id
          from public.story_reactions sr
          where sr.user_id = v_uid
            and sr.story_id is not null
          union
          select sc.story_id
          from public.story_comments sc
          where sc.user_id = v_uid
        )
      )
  ),
  following_authors as (
    select uf.following_id as user_id
    from public.user_follows uf
    where uf.follower_id = v_uid
  ),
  scored as (
    select
      s.id,
      s.user_id,
      s.place_id,
      s.content,
      s.media_url,
      s.media_blurhashes,
      s.created_at,
      case
        when v_uid is not null and exists (
          select 1 from following_authors fa where fa.user_id = s.user_id
        ) then 0::smallint
        when v_uid is not null
          and s.place_id is not null
          and exists (select 1 from interacted_places ip where ip.place_id = s.place_id)
          then 1::smallint
        else 2::smallint
      end as feed_score
    from public.stories s
    where s.expiry_time > now()
  ),
  page_raw as (
    select sc.*
    from scored sc
    where
      p_cursor_score is null
      or (
        sc.feed_score > p_cursor_score
        or (
          sc.feed_score = p_cursor_score
          and sc.created_at < p_cursor_created_at
        )
        or (
          sc.feed_score = p_cursor_score
          and sc.created_at = p_cursor_created_at
          and sc.id < p_cursor_id
        )
      )
    order by sc.feed_score asc, sc.created_at desc, sc.id desc
    limit v_limit + 1
  ),
  page_meta as (
    select count(*)::integer as raw_count from page_raw
  ),
  page as (
    select pr.*
    from page_raw pr
    order by pr.feed_score asc, pr.created_at desc, pr.id desc
    limit v_limit
  ),
  comment_stats as (
    select
      sc.story_id,
      count(*) filter (where sc.parent_id is null)::integer as comment_count
    from public.story_comments sc
    where sc.story_id in (select p.id from page p)
    group by sc.story_id
  ),
  comment_preview as (
    select
      sub.story_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', sub.id,
            'content', sub.content,
            'created_at', sub.created_at
          )
          order by sub.created_at desc
        ),
        '[]'::jsonb
      ) as preview
    from (
      select
        sc.id,
        sc.story_id,
        sc.content,
        sc.created_at,
        row_number() over (
          partition by sc.story_id
          order by sc.created_at desc
        ) as rn
      from public.story_comments sc
      where sc.story_id in (select p.id from page p)
        and sc.parent_id is null
    ) sub
    where sub.rn <= 2
    group by sub.story_id
  ),
  reaction_stats as (
    select
      sr.story_id,
      count(*)::integer as reaction_count
    from public.story_reactions sr
    where sr.story_id in (select p.id from page p)
      and sr.type = 'like'
    group by sr.story_id
  ),
  my_reactions as (
    select sr.story_id, sr.type::text as my_reaction
    from public.story_reactions sr
    where v_uid is not null
      and sr.story_id in (select p.id from page p)
      and sr.user_id = v_uid
  ),
  enriched as (
    select
      p.id,
      p.user_id,
      p.place_id,
      p.content,
      p.media_url,
      p.media_blurhashes,
      p.created_at,
      p.feed_score,
      coalesce(rs.reaction_count, 0) as reaction_count,
      coalesce(cs.comment_count, 0) as comment_count,
      mr.my_reaction,
      coalesce(cp.preview, '[]'::jsonb) as comment_preview,
      coalesce(bc.name, 'Unknown place') as place_name,
      case
        when bc.id is null then null
        else jsonb_build_object(
          'id', bc.id,
          'name', bc.name,
          'images', coalesce(bc.images, '[]'::jsonb)
        )
      end as business_card,
      case
        when pp.id is null then null
        else jsonb_build_object(
          'id', pp.id,
          'first_name', pp.first_name,
          'last_name', pp.last_name,
          'avatar_url', pp.avatar_url,
          'username', pp.username
        )
      end as profile,
      (v_uid is not null and p.feed_score = 0) as is_followed_author
    from page p
    left join public.business_cards bc on bc.id = p.place_id
    left join public.public_profiles pp on pp.id = p.user_id
    left join comment_stats cs on cs.story_id = p.id
    left join comment_preview cp on cp.story_id = p.id
    left join reaction_stats rs on rs.story_id = p.id
    left join my_reactions mr on mr.story_id = p.id
    order by p.feed_score asc, p.created_at desc, p.id desc
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'user_id', e.user_id,
            'place_id', e.place_id,
            'content', e.content,
            'media_url', e.media_url,
            'media_blurhashes', e.media_blurhashes,
            'created_at', e.created_at,
            'reaction_count', e.reaction_count,
            'comment_count', e.comment_count,
            'my_reaction', e.my_reaction,
            'profile', e.profile,
            'place_name', e.place_name,
            'business_card', e.business_card,
            'comment_preview', e.comment_preview,
            'is_followed_author', e.is_followed_author
          )
          order by e.feed_score asc, e.created_at desc, e.id desc
        )
        from enriched e
      ),
      '[]'::jsonb
    ),
    (select raw_count > v_limit from page_meta),
    (
      select jsonb_build_object(
        'score', last_row.feed_score,
        'created_at', last_row.created_at,
        'id', last_row.id
      )
      from (
        select p.feed_score, p.created_at, p.id
        from page p
        order by p.feed_score asc, p.created_at desc, p.id desc
        limit 1
      ) last_row
    )
  into v_stories, v_has_more, v_next_cursor;

  if not v_has_more then
    v_next_cursor := null;
  end if;

  return jsonb_build_object(
    'stories', v_stories,
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );
end;
$$;

grant execute on function public.get_stories_feed_page(integer, smallint, timestamptz, uuid) to anon, authenticated;

comment on function public.get_stories_feed_page(integer, smallint, timestamptz, uuid) is
  'Paginated stories feed with server-side affinity scoring (following > interacted place > other).';

notify pgrst, 'reload schema';
