-- Editorial workflow. Every write to stories, story_revisions and published_stories goes through
-- these functions: they check the role, lock the row, compare the version the client last saw
-- (optimistic locking) and record a revision.
--
--   create/import/ai_draft → draft ⇄ in_review → changes_requested ↺ … → publish → published
--   Saving a published story makes it a draft again until it is published again.
--   Two-person rule: the publisher is not the last person who changed the content.

/** Today's date in Ulaanbaatar as 'YYYY-MM-DD'. */
create function open_private.today_ub()
returns text
language sql
stable
set search_path = ''
as $$ select to_char(now() at time zone 'Asia/Ulaanbaatar', 'YYYY-MM-DD') $$;

create function open_private.add_revision(
  p_story_id text,
  p_content jsonb,
  p_action open.revision_action,
  p_note text default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into open.story_revisions (story_id, content, action, note, author)
  values (p_story_id, p_content, p_action, nullif(btrim(p_note), ''), (select auth.uid()))
  returning id
$$;

/** The working copy, locked for update; 404 when missing, 409 when `p_version` is stale. */
create function open_private.lock_story(p_id text, p_version integer)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story open.stories;
begin
  select * into story from open.stories where id = p_id for update;
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
create function open_private.normalize_content(p_id text, p_content jsonb)
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

create function open.create_story(
  p_id text,
  p_content jsonb,
  p_action open.revision_action default 'create'
)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('editor');
  doc jsonb;
  story open.stories;
begin
  if p_action not in ('create', 'import', 'ai_draft') then
    raise exception 'invalid_action' using errcode = 'PT400';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_id) > 80 then
    raise exception 'invalid_id' using errcode = 'PT400';
  end if;
  if exists (select 1 from open.stories where id = p_id) then
    raise exception 'id_taken' using errcode = 'PT409';
  end if;
  doc := open_private.normalize_content(p_id, p_content);
  insert into open.stories (id, content, created_by, updated_by)
  values (p_id, doc, uid, uid)
  returning * into story;
  perform open_private.add_revision(p_id, doc, p_action);
  return story;
end;
$$;

-- ---- save / restore ----------------------------------------------------------------------------

create function open_private.apply_content(
  p_id text,
  p_content jsonb,
  p_version integer,
  p_action open.revision_action,
  p_note text default null
)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('editor');
  story open.stories := open_private.lock_story(p_id, p_version);
  doc jsonb := open_private.normalize_content(p_id, p_content);
begin
  if doc = story.content then
    return story;
  end if;
  update open.stories
  set content = doc,
      state = case when state = 'published' then 'draft'::open.story_state else state end,
      version = version + 1,
      updated_by = uid,
      updated_at = now()
  where id = p_id
  returning * into story;
  perform open_private.add_revision(p_id, doc, p_action, p_note);
  return story;
end;
$$;

create function open.save_story(p_id text, p_content jsonb, p_version integer)
returns open.stories
language sql
security definer
set search_path = ''
as $$ select * from open_private.apply_content(p_id, p_content, p_version, 'save') $$;

create function open.restore_revision(p_revision_id bigint, p_version integer)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision open.story_revisions;
begin
  perform open_private.require_role('editor');
  select * into revision from open.story_revisions where id = p_revision_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  return open_private.apply_content(
    revision.story_id, revision.content, p_version, 'restore', format('#%s', revision.id)
  );
end;
$$;

-- ---- review ------------------------------------------------------------------------------------

create function open.submit_story(p_id text, p_version integer, p_note text default null)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('editor');
  story open.stories := open_private.lock_story(p_id, p_version);
begin
  if story.state not in ('draft', 'changes_requested') then
    raise exception 'invalid_state' using errcode = 'PT409', detail = story.state::text;
  end if;
  update open.stories
  set state = 'in_review', submitted_by = uid, submitted_at = now(), version = version + 1
  where id = p_id
  returning * into story;
  perform open_private.add_revision(p_id, story.content, 'submit', p_note);
  return story;
end;
$$;

create function open.request_changes(p_id text, p_version integer, p_note text)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story open.stories;
begin
  perform open_private.require_role('reviewer');
  story := open_private.lock_story(p_id, p_version);
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = 'PT400';
  end if;
  if story.state <> 'in_review' then
    raise exception 'invalid_state' using errcode = 'PT409', detail = story.state::text;
  end if;
  update open.stories
  set state = 'changes_requested', review_note = btrim(p_note), version = version + 1
  where id = p_id
  returning * into story;
  perform open_private.add_revision(p_id, story.content, 'request_changes', p_note);
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
create function open.publish_story(
  p_id text,
  p_version integer,
  p_note text default null,
  p_correction text default null
)
returns open.published_stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := open_private.require_role('reviewer');
  story open.stories := open_private.lock_story(p_id, p_version);
  today text := open_private.today_ub();
  reviewer text;
  was_published boolean;
  correction text := nullif(btrim(p_correction), '');
  doc jsonb := story.content;
  problems text[];
  revision_id bigint;
  result open.published_stories;
begin
  if story.state = 'published' then
    raise exception 'already_published' using errcode = 'PT409';
  end if;
  if (select require_two_person_review from open.settings) and story.updated_by = uid then
    raise exception 'same_person' using errcode = 'PT403';
  end if;

  select name into reviewer from open.staff where user_id = uid;
  was_published := exists (
    select 1 from open.story_revisions where story_id = p_id and action = 'publish'
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

  problems := open_private.story_problems(doc);
  if cardinality(problems) > 0 then
    raise exception 'story_problems' using errcode = 'PT422', detail = array_to_json(problems)::text;
  end if;

  revision_id := open_private.add_revision(p_id, doc, 'publish', p_note);
  insert into open.published_stories as p
    (id, content, revision_id, first_published_at, published_at, published_by)
  values (p_id, open_private.published_content(doc), revision_id, now(), now(), uid)
  on conflict (id) do update
    set content = excluded.content,
        revision_id = excluded.revision_id,
        published_at = excluded.published_at,
        published_by = excluded.published_by
  returning * into result;

  -- the working copy keeps its reviewer notes and now matches what is live
  update open.stories
  set content = doc, state = 'published', review_note = null, version = version + 1
  where id = p_id;
  return result;
end;
$$;

create function open.unpublish_story(p_id text, p_version integer, p_note text)
returns open.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  story open.stories;
begin
  perform open_private.require_role('reviewer');
  story := open_private.lock_story(p_id, p_version);
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'note_required' using errcode = 'PT400';
  end if;
  delete from open.published_stories where id = p_id;
  if not found then
    raise exception 'not_published' using errcode = 'PT409';
  end if;
  update open.stories
  set state = 'draft', version = version + 1
  where id = p_id
  returning * into story;
  perform open_private.add_revision(p_id, story.content, 'unpublish', p_note);
  return story;
end;
$$;

create function open.delete_story(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform open_private.require_role('admin');
  if exists (select 1 from open.published_stories where id = p_id) then
    raise exception 'is_published' using errcode = 'PT409';
  end if;
  delete from open.stories where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
end;
$$;

-- ---- grants ------------------------------------------------------------------------------------

revoke execute on function
  open.create_story(text, jsonb, open.revision_action),
  open.save_story(text, jsonb, integer),
  open.restore_revision(bigint, integer),
  open.submit_story(text, integer, text),
  open.request_changes(text, integer, text),
  open.publish_story(text, integer, text, text),
  open.unpublish_story(text, integer, text),
  open.delete_story(text)
  from public, anon;

grant execute on function
  open.create_story(text, jsonb, open.revision_action),
  open.save_story(text, jsonb, integer),
  open.restore_revision(bigint, integer),
  open.submit_story(text, integer, text),
  open.request_changes(text, integer, text),
  open.publish_story(text, integer, text, text),
  open.unpublish_story(text, integer, text),
  open.delete_story(text)
  to authenticated;
