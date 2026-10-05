-- Document watcher: official pages staff follow (a bill's page, a draft on legalinfo.mn…). The
-- watch-documents edge function fetches each page about once a day, keeps its text, and records
-- a change event when the text differs from the last fetch. Editors see the change as a diff and
-- mark it seen. Staff read everything; writes go through the functions below.

-- public https pages only: a host name with a dot and a letter TLD (no IP address, no localhost,
-- no port, no user info). The edge function applies the same rule to every redirect.
create function open_private.is_watchable_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select length(p_url) <= 2000
    and p_url ~ '^https://[A-Za-z0-9.-]+\.([A-Za-z]{2,}|xn--[A-Za-z0-9-]+)([/?#][^[:space:]]*)?$'
$$;

create table open.watched_documents (
  id bigint generated always as identity primary key,
  url text not null unique check (open_private.is_watchable_url(url)),
  label text not null check (label = btrim(label) and length(label) between 1 and 200),
  story_id text references open.stories (id) on delete set null,
  active boolean not null default true,
  -- the last successful fetch: hash of its text (of its bytes when it is not text), and the text
  last_hash text,
  last_text text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_status text check (last_status in ('first', 'unchanged', 'changed', 'error')),
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table open.watched_documents is 'Official pages the watch-documents function checks.';
create index watched_documents_story_idx on open.watched_documents (story_id);
create index watched_documents_created_by_idx on open.watched_documents (created_by);

create table open.watch_events (
  id bigint generated always as identity primary key,
  document_id bigint not null references open.watched_documents (id) on delete cascade,
  -- null when the page is not text (a PDF, an image): only its hash changed
  old_text text,
  new_text text,
  detected_at timestamptz not null default now(),
  seen_by uuid references auth.users (id) on delete set null,
  seen_at timestamptz
);
comment on table open.watch_events is 'A watched page whose text changed since the previous fetch.';
create index watch_events_document_idx on open.watch_events (document_id, detected_at desc);
create index watch_events_unseen_idx on open.watch_events (detected_at desc) where seen_at is null;
create index watch_events_seen_by_idx on open.watch_events (seen_by);

alter table open.watched_documents enable row level security;
alter table open.watch_events enable row level security;
create policy "staff can read watched documents" on open.watched_documents
  for select to authenticated using ((select open_private.is_staff()));
create policy "staff can read watch events" on open.watch_events
  for select to authenticated using ((select open_private.is_staff()));
revoke all on open.watched_documents, open.watch_events from anon;
revoke insert, update, delete, truncate on open.watched_documents, open.watch_events
  from authenticated;

-- ---- staff ---------------------------------------------------------------------------------------

create function open.add_watched_document(p_url text, p_label text, p_story_id text default null)
returns open.watched_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('editor');
  address text := btrim(coalesce(p_url, ''));
  name text := btrim(coalesce(p_label, ''));
  story text := nullif(btrim(coalesce(p_story_id, '')), '');
  doc open.watched_documents;
begin
  if not open_private.is_watchable_url(address) or length(name) not between 1 and 200 then
    raise exception 'invalid_input' using errcode = 'PT400';
  end if;
  if story is not null and not exists (select 1 from open.stories where id = story) then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if exists (select 1 from open.watched_documents where url = address) then
    raise exception 'url_taken' using errcode = 'PT409';
  end if;
  insert into open.watched_documents (url, label, story_id, created_by)
  values (address, name, story, uid)
  returning * into doc;
  return doc;
end;
$$;

create function open.update_watched_document(
  p_id bigint,
  p_label text,
  p_story_id text,
  p_active boolean
)
returns open.watched_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := btrim(coalesce(p_label, ''));
  story text := nullif(btrim(coalesce(p_story_id, '')), '');
  doc open.watched_documents;
begin
  perform open_private.require_role('editor');
  if length(name) not between 1 and 200 or p_active is null then
    raise exception 'invalid_input' using errcode = 'PT400';
  end if;
  if story is not null and not exists (select 1 from open.stories where id = story) then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  update open.watched_documents
  set label = name, story_id = story, active = p_active
  where id = p_id
  returning * into doc;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return doc;
end;
$$;

/** Stop watching a page; its change history goes with it. */
create function open.remove_watched_document(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform open_private.require_role('editor');
  delete from open.watched_documents where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
end;
$$;

/** Mark changes as seen by the caller; returns how many were still unseen. */
create function open.mark_watch_events_seen(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('editor');
  marked integer;
begin
  update open.watch_events
  set seen_by = uid, seen_at = now()
  where id = any (p_ids) and seen_at is null;
  get diagnostics marked = row_count;
  return marked;
end;
$$;

-- ---- the watch-documents function (service role) -------------------------------------------------

/**
 * Pages to check now, marked as checked so a parallel run skips them: active pages not checked
 * for `p_min_age` (or the pages `p_ids`, active or not), least recently checked first.
 */
create function open.claim_watched_documents(
  p_min_age interval,
  p_ids bigint[] default null,
  p_limit integer default 10
)
returns table (id bigint, url text)
language sql
security definer
set search_path = ''
as $$
  update open.watched_documents d
  set last_checked_at = now()
  where d.id in (
    select w.id
    from open.watched_documents w
    where (case when p_ids is null then w.active else w.id = any (p_ids) end)
      and (w.last_checked_at is null or w.last_checked_at <= now() - p_min_age)
    order by w.last_checked_at nulls first, w.id
    limit least(greatest(p_limit, 0), 50)
    for update skip locked
  )
  returning d.id, d.url
$$;

/**
 * Store one fetch: the first successful one sets the baseline; a different hash records a change
 * event with the previous and the new text. Returns the page's new status.
 */
create function open.record_watch_result(
  p_id bigint,
  p_hash text,
  p_text text,
  p_error text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc open.watched_documents;
  status text;
begin
  select * into doc from open.watched_documents where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if p_error is not null or p_hash is null then
    status := 'error';
    update open.watched_documents
    set last_checked_at = now(), last_status = status,
        last_error = left(coalesce(p_error, 'no_hash'), 1000)
    where id = p_id;
    return status;
  end if;

  status := case
    when doc.last_hash is null then 'first'
    when doc.last_hash = p_hash then 'unchanged'
    else 'changed'
  end;
  if status = 'changed' then
    insert into open.watch_events (document_id, old_text, new_text)
    values (p_id, doc.last_text, p_text);
  end if;
  update open.watched_documents
  set last_hash = p_hash,
      last_text = p_text,
      last_checked_at = now(),
      last_changed_at = case when status = 'changed' then now() else last_changed_at end,
      last_status = status,
      last_error = null
  where id = p_id;
  return status;
end;
$$;

revoke execute on function
  open_private.is_watchable_url(text),
  open.add_watched_document(text, text, text),
  open.update_watched_document(bigint, text, text, boolean),
  open.remove_watched_document(bigint),
  open.mark_watch_events_seen(bigint[]),
  open.claim_watched_documents(interval, bigint[], integer),
  open.record_watch_result(bigint, text, text, text)
from public, anon;
grant execute on function
  open.add_watched_document(text, text, text),
  open.update_watched_document(bigint, text, text, boolean),
  open.remove_watched_document(bigint),
  open.mark_watch_events_seen(bigint[])
to authenticated;
revoke execute on function
  open.claim_watched_documents(interval, bigint[], integer),
  open.record_watch_result(bigint, text, text, text)
from authenticated;
grant execute on function
  open.claim_watched_documents(interval, bigint[], integer),
  open.record_watch_result(bigint, text, text, text)
to service_role;

-- every hour; a page is due again 20 hours after its last check, so each is checked about daily
select cron.schedule(
  'watch-documents', '7 * * * *',
  $$ select open_private.call_function('watch-documents', '{"source": "cron"}') $$
);
