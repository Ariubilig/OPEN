-- Reader features: error reports ("Алдаа мэдээлэх") and search.

-- ---- throttling --------------------------------------------------------------------------------

create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

/**
 * The caller's address as the gateway saw it. Not the first X-Forwarded-For entry: the client
 * writes that one. Hosted Supabase sits behind Cloudflare (cf-connecting-ip); locally the
 * gateway sets x-real-ip.
 */
create function private.client_address()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(h ->> 'x-real-ip', ''),
    nullif(btrim((regexp_split_to_array(h ->> 'x-forwarded-for', '\s*,\s*'))[
      cardinality(regexp_split_to_array(h ->> 'x-forwarded-for', '\s*,\s*'))
    ]), ''),
    'unknown'
  )
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb as h) as r
$$;

/** Count one use of `key` in the current window; 429 when there were `max` already. */
create function private.throttle(p_key text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  seconds double precision := extract(epoch from p_window);
  bucket timestamptz := to_timestamp(floor(extract(epoch from now()) / seconds) * seconds);
  used integer;
begin
  insert into private.rate_limits as r (key, window_start, count)
  values (p_key, bucket, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into used;
  if used > p_max then
    raise exception 'rate_limited' using errcode = 'PT429';
  end if;
  -- keep the table small: now and then drop windows older than a day
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
end;
$$;

-- ---- error reports -----------------------------------------------------------------------------

create table public.reports (
  id bigint generated always as identity primary key,
  story_id text not null references public.stories (id) on delete cascade,
  message text not null check (length(message) between 5 and 2000),
  contact text check (length(contact) <= 200),
  status text not null default 'new' check (status in ('new', 'resolved', 'dismissed')),
  resolution_note text check (length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz
);
comment on table public.reports is
  'Readers'' error reports on published stories. Written through submit_report(); staff read.';
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_story_idx on public.reports (story_id);
create index reports_resolved_by_idx on public.reports (resolved_by);

alter table public.reports enable row level security;
create policy "staff can read reports" on public.reports
  for select to authenticated using ((select private.is_staff()));
revoke all on public.reports from anon;
revoke insert, update, delete, truncate on public.reports from authenticated;

/** A reader reports an error in a published story. Limited to 10 an hour per address. */
create function public.submit_report(
  p_story_id text,
  p_message text,
  p_contact text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  message text := btrim(coalesce(p_message, ''));
  contact text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  if length(message) not between 5 and 2000 or length(coalesce(contact, '')) > 200 then
    raise exception 'invalid_input' using errcode = 'PT400';
  end if;
  if not exists (select 1 from public.published_stories where id = p_story_id) then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  perform private.throttle('report:' || private.client_address(), 10, interval '1 hour');
  perform private.throttle('report-story:' || p_story_id, 50, interval '1 hour');
  insert into public.reports (story_id, message, contact) values (p_story_id, message, contact);
end;
$$;

/** Staff close a report: resolved (fixed) or dismissed (nothing to fix). */
create function public.resolve_report(p_id bigint, p_status text, p_note text default null)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('editor');
  report public.reports;
begin
  if p_status not in ('new', 'resolved', 'dismissed') then
    raise exception 'invalid_input' using errcode = 'PT400';
  end if;
  update public.reports
  set status = p_status,
      resolution_note = nullif(btrim(coalesce(p_note, '')), ''),
      resolved_by = case when p_status = 'new' then null else uid end,
      resolved_at = case when p_status = 'new' then null else now() end
  where id = p_id
  returning * into report;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return report;
end;
$$;

revoke execute on function public.resolve_report(bigint, text, text) from public, anon;
grant execute on function public.resolve_report(bigint, text, text) to authenticated;

-- ---- search ------------------------------------------------------------------------------------

/**
 * Published stories matching every word of the query as a word prefix ("татвар" finds
 * "татварын"), best matches first. Up to 8 words, 50 results.
 */
create function public.search_stories(p_query text)
returns setof public.story_cards
language plpgsql
stable
set search_path = ''
as $$
declare
  words text[] := array(
    select w
    from (
      select regexp_replace(lower(part), '[^[:alnum:]]+', '', 'g') as w
      from regexp_split_to_table(left(coalesce(p_query, ''), 200), '\s+') as part
    ) as cleaned
    where length(w) > 0
    limit 8
  );
  query tsquery;
begin
  if cardinality(words) = 0 then
    return;
  end if;
  query := to_tsquery(
    'pg_catalog.simple',
    array_to_string(array(select quote_literal(w) || ':*' from unnest(words) as w), ' & ')
  );
  return query
    select c.*
    from public.story_cards c
    join public.published_stories p on p.id = c.id
    where p.search @@ query
    order by ts_rank(p.search, query) desc, c.sort_order nulls last, c.published_on desc
    limit 50;
end;
$$;
