-- Stories: working copies, their revisions, and the public snapshot.
--
-- A story is one JSON document in the shape of StorySchema (src/data/schema.ts).
--  * public.stories            working copy; staff only; may be half-filled while drafting
--  * public.story_revisions    every change to a working copy, with who, when and why
--  * public.published_stories  what readers see: written only by publish_story(), checked
--                              against the JSON Schema, reviewer notes removed

create type public.story_state as enum (
  'draft',              -- being written, or has changes that are not live yet
  'in_review',          -- submitted for a second person to check
  'changes_requested',  -- a reviewer sent it back with a note
  'published'           -- the working copy is exactly what is live
);

create type public.revision_action as enum (
  'create', 'import', 'ai_draft', 'save', 'restore',
  'submit', 'request_changes', 'publish', 'unpublish'
);

-- ---- helpers for generated columns (immutable) -------------------------------------------------

create function private.jsonb_texts(value jsonb)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when jsonb_typeof(value) = 'array'
    then array(select jsonb_array_elements_text(value))
    else '{}'::text[]
  end
$$;

/** Distinct `group` values of a story's `affects` list. */
create function private.affect_groups(affects jsonb)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when jsonb_typeof(affects) = 'array'
    then array(
      select distinct a ->> 'group'
      from jsonb_array_elements(affects) as a
      where a ->> 'group' is not null
      order by 1
    )
    else '{}'::text[]
  end
$$;

/** Search document: title (A), summary (B), official title (C). No stemming: Mongolian has no config. */
create function private.story_search_vector(content jsonb)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    setweight(to_tsvector('pg_catalog.simple', coalesce(content ->> 'title', '')), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', coalesce(content #>> '{summary,text}', '')), 'B') ||
    setweight(to_tsvector('pg_catalog.simple', coalesce(content #>> '{officialTitle,text}', '')), 'C')
$$;

grant execute on function private.jsonb_texts(jsonb), private.affect_groups(jsonb),
  private.story_search_vector(jsonb)
  to anon, authenticated, service_role;

-- ---- tables ------------------------------------------------------------------------------------

create table public.stories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content ->> 'id' = id),
  state public.story_state not null default 'draft',
  review_note text,
  version integer not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- the last person who changed the content (the two-person rule compares against it)
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  submitted_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz
);
comment on table public.stories is
  'Working copy of every story (staff only). Written through the workflow RPCs.';

create table public.story_revisions (
  id bigint generated always as identity primary key,
  story_id text not null references public.stories (id) on delete cascade,
  content jsonb not null,
  action public.revision_action not null,
  note text check (length(note) <= 2000),
  author uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.story_revisions is 'Every change to a working copy.';
create index story_revisions_story_idx on public.story_revisions (story_id, id desc);

create table public.published_stories (
  id text primary key references public.stories (id) on delete cascade,
  content jsonb not null check (content ->> 'id' = id),
  revision_id bigint not null references public.story_revisions (id),
  first_published_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  type text generated always as (content ->> 'type') stored,
  stage text generated always as (content ->> 'stage') stored,
  featured boolean generated always as ((content ->> 'featured')::boolean) stored,
  sort_order double precision generated always as ((content ->> 'order')::double precision) stored,
  published_on text generated always as (content ->> 'publishedAt') stored,
  topics text[] generated always as (private.jsonb_texts(content -> 'topics')) stored,
  groups text[] generated always as (private.affect_groups(content -> 'affects')) stored,
  search tsvector generated always as (private.story_search_vector(content)) stored
);
comment on table public.published_stories is
  'What readers see. Written only by publish_story(); reviewer notes are removed.';
create index published_stories_feed_idx
  on public.published_stories (sort_order nulls last, published_on desc);
create index published_stories_groups_idx on public.published_stories using gin (groups);
create index published_stories_search_idx on public.published_stories using gin (search);

-- foreign keys to people and revisions (deleting a user or a story looks these up)
create index stories_created_by_idx on public.stories (created_by);
create index stories_updated_by_idx on public.stories (updated_by);
create index stories_submitted_by_idx on public.stories (submitted_by);
create index story_revisions_author_idx on public.story_revisions (author);
create index published_stories_published_by_idx on public.published_stories (published_by);
create index published_stories_revision_idx on public.published_stories (revision_id);

-- ---- row-level security ------------------------------------------------------------------------

alter table public.stories enable row level security;
alter table public.story_revisions enable row level security;
alter table public.published_stories enable row level security;

create policy "staff can read working copies" on public.stories
  for select to authenticated
  using ((select private.is_staff()));

create policy "staff can read revisions" on public.story_revisions
  for select to authenticated
  using ((select private.is_staff()));

create policy "everyone can read published stories" on public.published_stories
  for select to anon, authenticated
  using (true);

revoke all on public.stories, public.story_revisions from anon;
revoke insert, update, delete, truncate
  on public.stories, public.story_revisions, public.published_stories
  from anon, authenticated;

-- ---- views -------------------------------------------------------------------------------------

/** What a feed card needs. Readers load full stories one at a time. */
create view public.story_cards
with (security_invoker = true)
as
select
  id,
  type,
  stage,
  topics,
  groups,
  featured,
  sort_order,
  published_on,
  content ->> 'title' as title,
  content -> 'summary' as summary,
  content -> 'timeline' as timeline,
  jsonb_array_length(content -> 'sources') as source_count
from public.published_stories;

/** Count of TODO_VERIFY values in a document, reviewer notes excluded. */
create function private.count_todos(content jsonb)
returns integer
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  total integer := 0;
  item record;
begin
  case jsonb_typeof(content)
    when 'object' then
      for item in select key, value from jsonb_each(content) where key <> 'verify' loop
        total := total + private.count_todos(item.value);
      end loop;
    when 'array' then
      for item in select value from jsonb_array_elements(content) loop
        total := total + private.count_todos(item.value);
      end loop;
    when 'string' then
      total := (length(content #>> '{}') - length(replace(content #>> '{}', 'TODO_VERIFY', '')))
        / length('TODO_VERIFY');
    else
      null;
  end case;
  return total;
end;
$$;
grant execute on function private.count_todos(jsonb) to authenticated;

/** The admin's story list: working copy, state, live or not, who changed it last. */
create view public.story_admin_list
with (security_invoker = true)
as
select
  s.id,
  s.state,
  s.version,
  s.content ->> 'title' as title,
  s.content ->> 'type' as type,
  s.content ->> 'stage' as stage,
  s.review_note,
  s.created_at,
  s.updated_at,
  s.updated_by,
  editor.name as updated_by_name,
  s.submitted_at,
  submitter.name as submitted_by_name,
  p.id is not null as is_live,
  p.first_published_at,
  p.published_at,
  private.count_todos(s.content) as todo_count
from public.stories s
left join public.published_stories p on p.id = s.id
left join public.staff editor on editor.user_id = s.updated_by
left join public.staff submitter on submitter.user_id = s.submitted_by;

revoke all on public.story_admin_list from anon;
