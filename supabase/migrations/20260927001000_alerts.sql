-- Email alerts: a reader follows a story and gets an email when its stage changes.
--
--   subscribe()            the reader's address + story; a confirmation email the first time
--   confirm_subscription() the link in that email (double opt-in)
--   unsubscribe()          one story or all; an address with nothing left to follow is deleted
--   stage change           trigger on published_stories → one email per confirmed follower
--   email_outbox           every email waits here; the send-emails edge function delivers them
--
-- Addresses are personal data: only admins can read them, and only as counts in the admin UI.

create extension if not exists pg_cron;

-- ---- calling edge functions from the database --------------------------------------------------

/** POST to an edge function (fire and forget); nothing happens while settings.functions_url is unset. */
create function private.call_function(p_name text, p_body jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := (select functions_url from public.settings);
begin
  if base is not null then
    perform net.http_post(url := base || '/' || p_name, body := p_body, timeout_milliseconds := 10000);
  end if;
end;
$$;

-- ---- tables ------------------------------------------------------------------------------------

create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(email) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- in every link we send: confirm, unsubscribe
  token uuid not null unique default gen_random_uuid(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.subscribers is 'Readers who follow stories by email. Admins only.';

create table public.subscriptions (
  subscriber_id uuid not null references public.subscribers (id) on delete cascade,
  story_id text not null references public.stories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, story_id)
);
create index subscriptions_story_idx on public.subscriptions (story_id);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  template text not null check (template in ('confirm', 'stage_change')),
  data jsonb not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
comment on table public.email_outbox is
  'Emails waiting to be sent by the send-emails edge function. Admins can read it.';
create index email_outbox_pending_idx on public.email_outbox (status, id);

alter table public.subscribers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.email_outbox enable row level security;

create policy "admins can read subscribers" on public.subscribers
  for select to authenticated using ((select private.is_admin()));
create policy "admins can read subscriptions" on public.subscriptions
  for select to authenticated using ((select private.is_admin()));
create policy "admins can read the outbox" on public.email_outbox
  for select to authenticated using ((select private.is_admin()));

revoke all on public.subscribers, public.subscriptions, public.email_outbox from anon;
revoke insert, update, delete, truncate
  on public.subscribers, public.subscriptions, public.email_outbox
  from authenticated;

-- A new email goes out right away (the function also runs every 10 minutes, for retries).
create function private.outbox_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.call_function('send-emails');
  return null;
end;
$$;

create trigger email_outbox_wake
  after insert on public.email_outbox
  for each statement execute function private.outbox_wake();

-- ---- what readers can do -----------------------------------------------------------------------

/**
 * Follow a published story. The first time an address follows anything, it gets a confirmation
 * email; until then nothing else is sent to it. Limited per address and per mailbox.
 */
create function public.subscribe(p_email text, p_story_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  address text := lower(btrim(coalesce(p_email, '')));
  story_title text;
  subscriber public.subscribers;
begin
  if length(address) > 254 or address !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_input' using errcode = 'PT400';
  end if;
  select content ->> 'title' into story_title from public.published_stories where id = p_story_id;
  if story_title is null then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  perform private.throttle('subscribe:' || private.client_address(), 10, interval '1 hour');
  -- nobody can use this form to flood someone else's mailbox
  perform private.throttle('subscribe-email:' || address, 3, interval '1 hour');

  insert into public.subscribers (email) values (address)
  on conflict (email) do update set email = excluded.email
  returning * into subscriber;
  insert into public.subscriptions (subscriber_id, story_id)
  values (subscriber.id, p_story_id)
  on conflict do nothing;

  if subscriber.confirmed_at is null then
    insert into public.email_outbox (to_email, template, data)
    values (
      address, 'confirm',
      jsonb_build_object('token', subscriber.token, 'story_id', p_story_id, 'title', story_title)
    );
  end if;
end;
$$;

/** The confirmation link: the address becomes active; returns the stories it follows (or null). */
create function public.confirm_subscription(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  subscriber public.subscribers;
begin
  update public.subscribers
  set confirmed_at = coalesce(confirmed_at, now())
  where token = p_token
  returning * into subscriber;
  if not found then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.content ->> 'title') order by s.created_at)
    from public.subscriptions s
    join public.published_stories p on p.id = s.story_id
    where s.subscriber_id = subscriber.id
  ), '[]'::jsonb);
end;
$$;

/**
 * Stop following one story, or every story when p_story_id is null. An address that follows
 * nothing any more is deleted. True when the token was known.
 */
create function public.unsubscribe(p_token uuid, p_story_id text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := (select id from public.subscribers where token = p_token);
begin
  if target is null then
    return false;
  end if;
  delete from public.subscriptions s
  where s.subscriber_id = target
    and (p_story_id is null or s.story_id = p_story_id);
  delete from public.subscribers s
  where s.id = target
    and not exists (select 1 from public.subscriptions x where x.subscriber_id = s.id);
  return true;
end;
$$;

/** How many confirmed readers follow a story (staff; no addresses). */
create function public.follower_count(p_story_id text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('editor');
  return (
    select count(*)
    from public.subscriptions s
    join public.subscribers r on r.id = s.subscriber_id
    where s.story_id = p_story_id and r.confirmed_at is not null
  );
end;
$$;

revoke execute on function public.follower_count(text) from public, anon;
grant execute on function public.follower_count(text) to authenticated;

-- ---- stage changes -----------------------------------------------------------------------------

create function private.notify_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_outbox (to_email, template, data)
  select r.email, 'stage_change', jsonb_build_object(
    'token', r.token,
    'story_id', new.id,
    'title', new.content ->> 'title',
    'old_stage', old.stage,
    'new_stage', new.stage
  )
  from public.subscriptions s
  join public.subscribers r on r.id = s.subscriber_id
  where s.story_id = new.id and r.confirmed_at is not null;
  return null;
end;
$$;

create trigger published_stories_stage_change
  after update on public.published_stories
  for each row
  when (old.stage is distinct from new.stage)
  execute function private.notify_stage_change();

-- ---- delivery (the send-emails edge function, with the service role) ---------------------------

/**
 * Take up to p_limit emails to send: pending ones, and ones stuck in 'sending' for 10 minutes
 * (a crashed run). Concurrent runs never take the same email. Includes the site URL for links.
 */
create function public.claim_emails(p_limit integer default 50)
returns table (id bigint, to_email text, template text, data jsonb, attempts integer, site_url text)
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.email_outbox o
    set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
    where o.id in (
      select x.id from public.email_outbox x
      where x.status = 'pending'
         or (x.status = 'sending' and x.claimed_at < now() - interval '10 minutes')
      order by x.id
      limit p_limit
      for update skip locked
    )
    returning o.id, o.to_email, o.template, o.data, o.attempts
  )
  select c.*, (select s.site_url from public.settings s) from claimed c order by c.id
$$;

/** Record how a claimed email went: sent, skipped (no mail service configured) or failed. */
create function public.finish_email(p_id bigint, p_status text, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox
  set status = case
        -- a failed email is tried again (next run) up to 5 times
        when p_status = 'failed' and attempts < 5 then 'pending'
        else p_status
      end,
      last_error = left(p_error, 1000),
      sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_id
$$;

revoke execute on function public.claim_emails(integer), public.finish_email(bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_emails(integer), public.finish_email(bigint, text, text)
  to service_role;

-- retries, and anything queued while the functions URL was not set yet
select cron.schedule('send-emails', '*/10 * * * *', $$ select private.call_function('send-emails') $$);
