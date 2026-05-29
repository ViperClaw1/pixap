-- UGC moderation: exclude blocked users from posts and stories feed RPCs.

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
      and not public.users_are_blocked(v_uid, s.user_id)
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

-- Posts feed: block filter on author profile branch and main feed.
create or replace function public.get_posts_feed_page(
  p_limit integer default 12,
  p_author_user_id uuid default null,
  p_cursor_boost_rank smallint default null,
  p_cursor_boosted_at timestamptz default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_score smallint default null,
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
  v_posts jsonb := '[]'::jsonb;
  v_next_cursor jsonb := null;
begin
  if p_author_user_id is not null then
    if public.users_are_blocked(v_uid, p_author_user_id) then
      return jsonb_build_object('posts', '[]'::jsonb, 'has_more', false, 'next_cursor', null);
    end if;

    with page_raw as (
      select
        p.id,
        p.user_id,
        p.place_id,
        p.content,
        p.media_url,
        null::jsonb as media_blurhashes,
        p.created_at,
        p.boosted_at,
        p.geo_place_name,
        p.geo_formatted_address,
        p.geo_latitude,
        p.geo_longitude,
        case when p.boosted_at is not null then 1::smallint else 0::smallint end as boost_rank
      from public.posts p
      where p.user_id = p_author_user_id
        and (
          p_cursor_id is null
          or (
            (p.boosted_at is null and p_cursor_boosted_at is not null)
            or (
              p.boosted_at is not null
              and p_cursor_boosted_at is not null
              and p.boosted_at < p_cursor_boosted_at
            )
            or (
              p.boosted_at is not distinct from p_cursor_boosted_at
              and p.created_at < p_cursor_created_at
            )
            or (
              p.boosted_at is not distinct from p_cursor_boosted_at
              and p.created_at = p_cursor_created_at
              and p.id < p_cursor_id
            )
          )
        )
      order by p.boosted_at desc nulls last, p.created_at desc, p.id desc
      limit v_limit + 1
    ),
    page_meta as (
      select count(*)::integer as raw_count from page_raw
    ),
    page as (
      select pr.*
      from page_raw pr
      order by pr.boosted_at desc nulls last, pr.created_at desc, pr.id desc
      limit v_limit
    ),
    comment_stats as (
      select
        pc.post_id,
        count(*) filter (where pc.parent_id is null)::integer as comment_count
      from public.post_comments pc
      where pc.post_id in (select pg.id from page pg)
      group by pc.post_id
    ),
    comment_preview as (
      select
        sub.post_id,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', sub.id,
              'content', sub.content,
              'created_at', sub.created_at,
              'avatar_url', sub.avatar_url
            )
            order by sub.created_at desc
          ),
          '[]'::jsonb
        ) as preview
      from (
        select
          pc.id,
          pc.post_id,
          pc.content,
          pc.created_at,
          pp.avatar_url,
          row_number() over (
            partition by pc.post_id
            order by pc.created_at desc
          ) as rn
        from public.post_comments pc
        left join public.public_profiles pp on pp.id = pc.user_id
        where pc.post_id in (select pg.id from page pg)
          and pc.parent_id is null
      ) sub
      where sub.rn <= 2
      group by sub.post_id
    ),
    reaction_stats as (
      select
        pr.post_id,
        count(*)::integer as reaction_count
      from public.post_reactions pr
      where pr.post_id in (select pg.id from page pg)
        and pr.type = 'like'
      group by pr.post_id
    ),
    my_reactions as (
      select pr.post_id, pr.type::text as my_reaction
      from public.post_reactions pr
      where v_uid is not null
        and pr.post_id in (select pg.id from page pg)
        and pr.user_id = v_uid
    ),
    enriched as (
      select
        p.id,
        p.user_id,
        p.place_id,
        p.content,
        p.media_url,
        null::jsonb as media_blurhashes,
        p.created_at,
        p.boosted_at,
        p.geo_place_name,
        p.geo_formatted_address,
        p.geo_latitude,
        p.geo_longitude,
        p.boost_rank,
        coalesce(rs.reaction_count, 0) as reaction_count,
        coalesce(cs.comment_count, 0) as comment_count,
        mr.my_reaction,
        coalesce(cp.preview, '[]'::jsonb) as comment_preview,
        coalesce(
          bc.name,
          case
            when p.place_id is not null then 'Unknown place'
            else coalesce(nullif(trim(p.geo_place_name), ''), nullif(trim(p.geo_formatted_address), ''), 'Place')
          end
        ) as place_name,
        case
          when bc.id is null then null
          else jsonb_build_object(
            'id', bc.id,
            'name', bc.name,
            'images', to_jsonb(coalesce(bc.images, array[]::text[]))
          )
        end as business_card,
        case
          when pp.id is null then null
          else jsonb_build_object(
            'id', pp.id,
            'first_name', pp.first_name,
            'last_name', pp.last_name,
            'avatar_url', pp.avatar_url,
            'username', pp.username,
            'is_verified', coalesce(pp.is_verified, false)
          )
        end as profile,
        (
          v_uid is not null
          and exists (
            select 1
            from public.user_follows uf
            where uf.follower_id = v_uid
              and uf.following_id = p.user_id
          )
        ) as is_followed_author
      from page p
      left join public.business_cards bc on bc.id = p.place_id
      left join public.public_profiles pp on pp.id = p.user_id
      left join comment_stats cs on cs.post_id = p.id
      left join comment_preview cp on cp.post_id = p.id
      left join reaction_stats rs on rs.post_id = p.id
      left join my_reactions mr on mr.post_id = p.id
      order by p.boosted_at desc nulls last, p.created_at desc, p.id desc
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
              'boosted_at', e.boosted_at,
              'geo_place_name', e.geo_place_name,
              'geo_formatted_address', e.geo_formatted_address,
              'geo_latitude', e.geo_latitude,
              'geo_longitude', e.geo_longitude,
              'reaction_count', e.reaction_count,
              'comment_count', e.comment_count,
              'my_reaction', e.my_reaction,
              'profile', e.profile,
              'place_name', e.place_name,
              'business_card', e.business_card,
              'comment_preview', e.comment_preview,
              'is_followed_author', e.is_followed_author
            )
            order by e.boosted_at desc nulls last, e.created_at desc, e.id desc
          )
          from enriched e
        ),
        '[]'::jsonb
      ),
      (select raw_count > v_limit from page_meta),
      (
        select jsonb_build_object(
          'boost_rank', last_row.boost_rank,
          'boosted_at', last_row.boosted_at,
          'created_at', last_row.created_at,
          'id', last_row.id
        )
        from (
          select p.boost_rank, p.boosted_at, p.created_at, p.id
          from page p
          order by p.boosted_at desc nulls last, p.created_at desc, p.id desc
          limit 1
        ) last_row
      )
    into v_posts, v_has_more, v_next_cursor;

    if not v_has_more then
      v_next_cursor := null;
    end if;

    return jsonb_build_object('posts', v_posts, 'has_more', v_has_more, 'next_cursor', v_next_cursor);
  end if;

  with interacted_places as (
    select distinct p.place_id
    from public.posts p
    where v_uid is not null
      and p.place_id is not null
      and (
        p.user_id = v_uid
        or p.id in (
          select pr.post_id
          from public.post_reactions pr
          where pr.user_id = v_uid
            and pr.post_id is not null
          union
          select pc.post_id
          from public.post_comments pc
          where pc.user_id = v_uid
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
      p.id,
      p.user_id,
      p.place_id,
      p.content,
      p.media_url,
      null::jsonb as media_blurhashes,
      p.created_at,
      p.boosted_at,
      p.geo_place_name,
      p.geo_formatted_address,
      p.geo_latitude,
      p.geo_longitude,
      case when p.boosted_at is not null then 1::smallint else 0::smallint end as boost_rank,
      case
        when v_uid is not null and exists (
          select 1 from following_authors fa where fa.user_id = p.user_id
        ) then 0::smallint
        when v_uid is not null
          and p.place_id is not null
          and exists (select 1 from interacted_places ip where ip.place_id = p.place_id)
          then 1::smallint
        else 2::smallint
      end as feed_score
    from public.posts p
    where not public.users_are_blocked(v_uid, p.user_id)
  ),
  page_raw as (
    select sc.*
    from scored sc
    where
      p_cursor_id is null
      or (
        sc.boost_rank < p_cursor_boost_rank
        or (
          sc.boost_rank = p_cursor_boost_rank
          and (
            (sc.boosted_at is null and p_cursor_boosted_at is not null)
            or (
              sc.boosted_at is not null
              and p_cursor_boosted_at is not null
              and sc.boosted_at < p_cursor_boosted_at
            )
            or (
              sc.boosted_at is not distinct from p_cursor_boosted_at
              and sc.created_at < p_cursor_created_at
            )
            or (
              sc.boosted_at is not distinct from p_cursor_boosted_at
              and sc.created_at = p_cursor_created_at
              and sc.feed_score > p_cursor_score
            )
            or (
              sc.boosted_at is not distinct from p_cursor_boosted_at
              and sc.created_at = p_cursor_created_at
              and sc.feed_score = p_cursor_score
              and sc.id < p_cursor_id
            )
          )
        )
      )
    order by sc.boost_rank desc, sc.boosted_at desc nulls last, sc.created_at desc, sc.feed_score asc, sc.id desc
    limit v_limit + 1
  ),
  page_meta as (
    select count(*)::integer as raw_count from page_raw
  ),
  page as (
    select pr.*
    from page_raw pr
    order by pr.boost_rank desc, pr.boosted_at desc nulls last, pr.created_at desc, pr.feed_score asc, pr.id desc
    limit v_limit
  ),
  comment_stats as (
    select
      pc.post_id,
      count(*) filter (where pc.parent_id is null)::integer as comment_count
    from public.post_comments pc
    where pc.post_id in (select pg.id from page pg)
    group by pc.post_id
  ),
  comment_preview as (
    select
      sub.post_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', sub.id,
            'content', sub.content,
            'created_at', sub.created_at,
            'avatar_url', sub.avatar_url
          )
          order by sub.created_at desc
        ),
        '[]'::jsonb
      ) as preview
    from (
      select
        pc.id,
        pc.post_id,
        pc.content,
        pc.created_at,
        pp.avatar_url,
        row_number() over (
          partition by pc.post_id
          order by pc.created_at desc
        ) as rn
      from public.post_comments pc
      left join public.public_profiles pp on pp.id = pc.user_id
      where pc.post_id in (select pg.id from page pg)
        and pc.parent_id is null
    ) sub
    where sub.rn <= 2
    group by sub.post_id
  ),
  reaction_stats as (
    select
      pr.post_id,
      count(*)::integer as reaction_count
    from public.post_reactions pr
    where pr.post_id in (select pg.id from page pg)
      and pr.type = 'like'
    group by pr.post_id
  ),
  my_reactions as (
    select pr.post_id, pr.type::text as my_reaction
    from public.post_reactions pr
    where v_uid is not null
      and pr.post_id in (select pg.id from page pg)
      and pr.user_id = v_uid
  ),
  enriched as (
    select
      p.id,
      p.user_id,
      p.place_id,
      p.content,
      p.media_url,
      null::jsonb as media_blurhashes,
      p.created_at,
      p.boosted_at,
      p.geo_place_name,
      p.geo_formatted_address,
      p.geo_latitude,
      p.geo_longitude,
      p.boost_rank,
      p.feed_score,
      coalesce(rs.reaction_count, 0) as reaction_count,
      coalesce(cs.comment_count, 0) as comment_count,
      mr.my_reaction,
      coalesce(cp.preview, '[]'::jsonb) as comment_preview,
      coalesce(
        bc.name,
        case
          when p.place_id is not null then 'Unknown place'
          else coalesce(nullif(trim(p.geo_place_name), ''), nullif(trim(p.geo_formatted_address), ''), 'Place')
        end
      ) as place_name,
      case
        when bc.id is null then null
        else jsonb_build_object(
          'id', bc.id,
          'name', bc.name,
          'images', to_jsonb(coalesce(bc.images, array[]::text[]))
        )
      end as business_card,
      case
        when pp.id is null then null
        else jsonb_build_object(
          'id', pp.id,
          'first_name', pp.first_name,
          'last_name', pp.last_name,
          'avatar_url', pp.avatar_url,
          'username', pp.username,
          'is_verified', coalesce(pp.is_verified, false)
        )
      end as profile,
      (v_uid is not null and p.feed_score = 0) as is_followed_author
    from page p
    left join public.business_cards bc on bc.id = p.place_id
    left join public.public_profiles pp on pp.id = p.user_id
    left join comment_stats cs on cs.post_id = p.id
    left join comment_preview cp on cp.post_id = p.id
    left join reaction_stats rs on rs.post_id = p.id
    left join my_reactions mr on mr.post_id = p.id
    order by p.boost_rank desc, p.boosted_at desc nulls last, p.created_at desc, p.feed_score asc, p.id desc
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
            'boosted_at', e.boosted_at,
            'geo_place_name', e.geo_place_name,
            'geo_formatted_address', e.geo_formatted_address,
            'geo_latitude', e.geo_latitude,
            'geo_longitude', e.geo_longitude,
            'reaction_count', e.reaction_count,
            'comment_count', e.comment_count,
            'my_reaction', e.my_reaction,
            'profile', e.profile,
            'place_name', e.place_name,
            'business_card', e.business_card,
            'comment_preview', e.comment_preview,
            'is_followed_author', e.is_followed_author
          )
          order by e.boost_rank desc, e.boosted_at desc nulls last, e.created_at desc, e.feed_score asc, e.id desc
        )
        from enriched e
      ),
      '[]'::jsonb
    ),
    (select raw_count > v_limit from page_meta),
    (
      select jsonb_build_object(
        'boost_rank', last_row.boost_rank,
        'boosted_at', last_row.boosted_at,
        'created_at', last_row.created_at,
        'score', last_row.feed_score,
        'id', last_row.id
      )
      from (
        select p.boost_rank, p.boosted_at, p.created_at, p.feed_score, p.id
        from page p
        order by p.boost_rank desc, p.boosted_at desc nulls last, p.created_at desc, p.feed_score asc, p.id desc
        limit 1
      ) last_row
    )
  into v_posts, v_has_more, v_next_cursor;

  if not v_has_more then
    v_next_cursor := null;
  end if;

  return jsonb_build_object('posts', v_posts, 'has_more', v_has_more, 'next_cursor', v_next_cursor);
end;
$$;

notify pgrst, 'reload schema';
