-- Editorial workflow. Every write to stories, story_revisions and published_stories goes through
-- these functions: they check the role, lock the row, compare the version the client last saw
-- (optimistic locking) and record a revision.
--
--   create/import/ai_draft → draft ⇄ in_review → changes_requested ↺ … → publish → published
--   Saving a published story makes it a draft again until it is published again.
--   Two-person rule: the publisher is not the last person who changed the content.

/** Today's date in Ulaanbaatar as 'YYYY-MM-DD'. */
create function private.today_ub()
returns text
language sql
stable
set search_path = ''
as $$ select to_char(now() at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD') $$;

create function private.add_revision(
  p_story_id text,
  p_content jsonb,
  p_action public.revision_action,
  p_note text default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.story_revisions (story_id, content, action, note, author)
  values (p_story_id, p_content, p_action, nullif(btrim(p_note), ''), (select auth.uid()))
  returning id
$$;

/** The working copy, locked for update; 404 when missing, 409 when `p_version` is stale. */
create function private.lock_story(p_id text, p_version integer)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story public.stories;
begin
  select * into story from public.stories where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if p_version is distinct from story.version then
    raise exception 'version_conflict' using errcode = 'PT409', detail = story.version::text;
  end if;
  return story;
end;
$$;

/** A client document as a working copy: an object, its `id` forced to the row id, no `draft`. */
create function private.normalize_content(p_id text, p_content jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'invalid_content' using errcode = 'PT400';
  end if;
  if pg_column_size(p_content) > 1000000 then
    raise exception 'content_too_large' using errcode = 'PT413';
  end if;
  return jsonb_set(p_content - 'draft', '{id}', to_jsonb(p_id));
end;
$$;

-- ---- create ------------------------------------------------------------------------------------

create function public.create_story(
  p_id text,
  p_content jsonb,
  p_action public.revision_action default 'create'
)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('editor');
  doc jsonb;
  story public.stories;
begin
  if p_action not in ('create', 'import', 'ai_draft') then
    raise exception 'invalid_action' using errcode = 'PT400';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_id) > 80 then
    raise exception 'invalid_id' using errcode = 'PT400';
  end if;
  if exists (select 1 from public.stories where id = p_id) then
    raise exception 'id_taken' using errcode = 'PT409';
  end if;
  doc := private.normalize_content(p_id, p_content);
  insert into public.stories (id, content, created_by, updated_by)
  values (p_id, doc, uid, uid)
  returning * into story;
  perform private.add_revision(p_id, doc, p_action);
  return story;
end;
$$;

-- ---- save / restore ----------------------------------------------------------------------------

create function private.apply_content(
  p_id text,
  p_content jsonb,
  p_version integer,
  p_action public.revision_action,
  p_note text default null
)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('editor');
  story public.stories := private.lock_story(p_id, p_version);
  doc jsonb := private.normalize_content(p_id, p_content);
begin
  if doc = story.content then
    return story;
  end if;
  update public.stories
  set content = doc,
      state = case when state = 'published' then 'draft'::public.story_state else state end,
      version = version + 1,
      updated_by = uid,
      updated_at = now()
  where id = p_id
  returning * into story;
  perform private.add_revision(p_id, doc, p_action, p_note);
  return story;
end;
$$;

create function public.save_story(p_id text, p_content jsonb, p_version integer)
returns public.stories
language sql
security definer
set search_path = ''
as $$ select * from private.apply_content(p_id, p_content, p_version, 'save') $$;

create function public.restore_revision(p_revision_id bigint, p_version integer)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision public.story_revisions;
begin
  perform private.require_role('editor');
  select * into revision from public.story_revisions where id = p_revision_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return private.apply_content(
    revision.story_id, revision.content, p_version, 'restore', format('#%s', revision.id)
  );
end;
$$;

-- ---- review ------------------------------------------------------------------------------------

create function public.submit_story(p_id text, p_version integer, p_note text default null)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('editor');
  story public.stories := private.lock_story(p_id, p_version);
begin
  if story.state not in ('draft', 'changes_requested') then
    raise exception 'invalid_state' using errcode = 'PT409', detail = story.state::text;
  end if;
  update public.stories
  set state = 'in_review', submitted_by = uid, submitted_at = now(), version = version + 1
  where id = p_id
  returning * into story;
  perform private.add_revision(p_id, story.content, 'submit', p_note);
  return story;
end;
$$;

create function public.request_changes(p_id text, p_version integer, p_note text)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story public.stories;
begin
  perform private.require_role('reviewer');
  story := private.lock_story(p_id, p_version);
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = 'PT400';
  end if;
  if story.state <> 'in_review' then
    raise exception 'invalid_state' using errcode = 'PT409', detail = story.state::text;
  end if;
  update public.stories
  set state = 'changes_requested', review_note = btrim(p_note), version = version + 1
  where id = p_id
  returning * into story;
  perform private.add_revision(p_id, story.content, 'request_changes', p_note);
  return story;
end;
$$;

-- ---- publish -----------------------------------------------------------------------------------

/**
 * Publish the working copy. Fills in what the publisher vouches for:
 *   publishedAt  today on the first publish; kept afterwards, with updatedAt = today
 *   reviewed     { by: the publisher's name, date: today }
 *   corrections  + { date: today, text: p_correction } when a correction is given
 * then checks story_problems() and writes the snapshot without reviewer notes.
 */
create function public.publish_story(
  p_id text,
  p_version integer,
  p_note text default null,
  p_correction text default null
)
returns public.published_stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('reviewer');
  story public.stories := private.lock_story(p_id, p_version);
  today text := private.today_ub();
  reviewer text;
  was_published boolean;
  correction text := nullif(btrim(p_correction), '');
  doc jsonb := story.content;
  problems text[];
  revision_id bigint;
  result public.published_stories;
begin
  if story.state = 'published' then
    raise exception 'already_published' using errcode = 'PT409';
  end if;
  if (select require_two_person_review from public.settings) and story.updated_by = uid then
    raise exception 'same_person' using errcode = 'PT403';
  end if;

  select name into reviewer from public.staff where user_id = uid;
  was_published := exists (
    select 1 from public.story_revisions where story_id = p_id and action = 'publish'
  );

  if was_published and doc ->> 'publishedAt' ~ '^\d{4}-\d{2}-\d{2}$' then
    doc := jsonb_set(doc, '{updatedAt}', to_jsonb(today));
  else
    doc := jsonb_set(doc - 'updatedAt', '{publishedAt}', to_jsonb(today));
  end if;
  doc := jsonb_set(doc, '{reviewed}', jsonb_build_object('by', reviewer, 'date', today));
  if correction is not null then
    if not was_published then
      raise exception 'correction_before_publish' using errcode = 'PT400';
    end if;
    doc := jsonb_set(
      doc, '{corrections}',
      coalesce(doc -> 'corrections', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('date', today, 'text', correction))
    );
  end if;

  problems := private.story_problems(doc);
  if cardinality(problems) > 0 then
    raise exception 'story_problems' using errcode = 'PT422', detail = array_to_json(problems)::text;
  end if;

  revision_id := private.add_revision(p_id, doc, 'publish', p_note);
  insert into public.published_stories as p
    (id, content, revision_id, first_published_at, published_at, published_by)
  values (p_id, private.published_content(doc), revision_id, now(), now(), uid)
  on conflict (id) do update
    set content = excluded.content,
        revision_id = excluded.revision_id,
        published_at = excluded.published_at,
        published_by = excluded.published_by
  returning * into result;

  -- the working copy keeps its reviewer notes and now matches what is live
  update public.stories
  set content = doc, state = 'published', review_note = null, version = version + 1
  where id = p_id;
  return result;
end;
$$;

create function public.unpublish_story(p_id text, p_version integer, p_note text)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story public.stories;
begin
  perform private.require_role('reviewer');
  story := private.lock_story(p_id, p_version);
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = 'PT400';
  end if;
  delete from public.published_stories where id = p_id;
  if not found then
    raise exception 'not_published' using errcode = 'PT409';
  end if;
  update public.stories
  set state = 'draft', version = version + 1
  where id = p_id
  returning * into story;
  perform private.add_revision(p_id, story.content, 'unpublish', p_note);
  return story;
end;
$$;

create function public.delete_story(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');
  if exists (select 1 from public.published_stories where id = p_id) then
    raise exception 'is_published' using errcode = 'PT409';
  end if;
  delete from public.stories where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
end;
$$;

-- ---- grants ------------------------------------------------------------------------------------

revoke execute on function
  public.create_story(text, jsonb, public.revision_action),
  public.save_story(text, jsonb, integer),
  public.restore_revision(bigint, integer),
  public.submit_story(text, integer, text),
  public.request_changes(text, integer, text),
  public.publish_story(text, integer, text, text),
  public.unpublish_story(text, integer, text),
  public.delete_story(text)
  from public, anon;

grant execute on function
  public.create_story(text, jsonb, public.revision_action),
  public.save_story(text, jsonb, integer),
  public.restore_revision(bigint, integer),
  public.submit_story(text, integer, text),
  public.request_changes(text, integer, text),
  public.publish_story(text, integer, text, text),
  public.unpublish_story(text, integer, text),
  public.delete_story(text)
  to authenticated;
