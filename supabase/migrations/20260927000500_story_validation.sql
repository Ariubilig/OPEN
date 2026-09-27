-- The publish gate. Structure: JSON Schemas generated from zod (20260927000400_json_schemas.sql).
-- Rules the schema cannot express: story_problems(), the SQL twin of src/lib/validate.ts.

alter table public.published_stories
  add constraint published_stories_content_schema
  check (extensions.jsonb_matches_schema(private.story_json_schema(), content));

alter table public.channels
  add constraint channels_content_schema
  check (extensions.jsonb_matches_schema(private.channel_json_schema(), content));

alter table public.tax_rules
  add constraint tax_rules_content_schema
  check (extensions.jsonb_matches_schema(private.tax_rules_json_schema(), content));

/**
 * Every source reference in a story with its JSON path, in the order the story page renders
 * them (same as sourceRefs() in src/lib/sources.ts).
 */
create function private.source_refs(story jsonb)
returns table (ord integer, path text, source text)
language sql
immutable
set search_path = ''
as $$
  with refs(ord, sub, path, source) as (
    select 1, 0, '$.officialTitle.source', story #>> '{officialTitle,source}'
    union all
    select 2, 0, '$.summary.source', story #>> '{summary,source}'
    union all
    select 3, (c.i - 1) * 3 + 0, format('$.changes[%s].plainBefore.source', c.i - 1),
      c.v #>> '{plainBefore,source}'
    from jsonb_array_elements(coalesce(story -> 'changes', '[]')) with ordinality as c(v, i)
    union all
    select 3, (c.i - 1) * 3 + 1, format('$.changes[%s].plainAfter.source', c.i - 1),
      c.v #>> '{plainAfter,source}'
    from jsonb_array_elements(coalesce(story -> 'changes', '[]')) with ordinality as c(v, i)
    union all
    select 3, (c.i - 1) * 3 + 2, format('$.changes[%s].lawSource', c.i - 1), c.v ->> 'lawSource'
    from jsonb_array_elements(coalesce(story -> 'changes', '[]')) with ordinality as c(v, i)
    union all
    select 4, k.i, format('$.keyNumbers[%s].source', k.i - 1), k.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'keyNumbers', '[]')) with ordinality as k(v, i)
    union all
    select 5, p.i, format('$.numberExplainer.paragraphs[%s].source', p.i - 1), p.v ->> 'source'
    from jsonb_array_elements(coalesce(story #> '{numberExplainer,paragraphs}', '[]'))
      with ordinality as p(v, i)
    union all
    select 6, m.i, format('$.meaning[%s].source', m.i - 1), m.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'meaning', '[]')) with ordinality as m(v, i)
    union all
    select 7, p.i, format('$.positions[%s].source', p.i - 1), p.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'positions', '[]')) with ordinality as p(v, i)
    union all
    select 8, a.i, format('$.affects[%s].source', a.i - 1), a.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'affects', '[]')) with ordinality as a(v, i)
    union all
    select 9, t.i, format('$.timeline[%s].source', t.i - 1), t.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'timeline', '[]')) with ordinality as t(v, i)
    where t.v ? 'source'
    union all
    select 10, e.i * 10000 + it.j,
      format('$.evidence[%s].items[%s].source', e.i - 1, it.j - 1), it.v ->> 'source'
    from jsonb_array_elements(coalesce(story -> 'evidence', '[]')) with ordinality as e(v, i),
      jsonb_array_elements(coalesce(e.v -> 'items', '[]')) with ordinality as it(v, j)
  )
  select (row_number() over (order by ord, sub))::integer, path, source from refs
$$;

/**
 * What stops a story from being published, as '<code> <json path>' strings; empty when none.
 * Codes: schema, duplicate_source, unknown_source, timeline_source_required,
 * timeline_current_count, timeline_order, featured_meaning, featured_affects, featured_evidence,
 * featured_participate, featured_numbers, unknown_related, unknown_channel.
 */
create function private.story_problems(story jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  problems text[] := '{}';
  source_ids text[];
  r record;
  current_count integer;
  previous_date text;
begin
  if not extensions.jsonb_matches_schema(private.story_json_schema(), story) then
    return array(
      select 'schema $ ' || e
      from unnest(extensions.jsonschema_validation_errors(
        private.story_json_schema(), story::json)) as e
    );
  end if;

  -- sources: unique ids; every reference known (TODO_VERIFY stands for "not known yet")
  source_ids := array(select s ->> 'id' from jsonb_array_elements(story -> 'sources') as s);
  for r in
    select i - 1 as idx, s ->> 'id' as id
    from jsonb_array_elements(story -> 'sources') with ordinality as x(s, i)
  loop
    if (select count(*) from unnest(source_ids[1:r.idx]) as prior(id) where prior.id = r.id) > 0 then
      problems := problems || format('duplicate_source $.sources[%s].id', r.idx);
    end if;
  end loop;
  for r in select path, source from private.source_refs(story) order by ord loop
    if r.source <> 'TODO_VERIFY' and not (r.source = any (source_ids)) then
      problems := problems || format('unknown_source %s', r.path);
    end if;
  end loop;

  -- timeline: done/current need a source, exactly one current, dates never go back
  for r in
    select i - 1 as idx, t
    from jsonb_array_elements(story -> 'timeline') with ordinality as x(t, i)
  loop
    if r.t ->> 'status' in ('done', 'current') and not (r.t ? 'source') then
      problems := problems || format('timeline_source_required $.timeline[%s].source', r.idx);
    end if;
    if jsonb_typeof(r.t -> 'date') = 'string' and r.t ->> 'date' ~ '^\d{4}-\d{2}-\d{2}$' then
      if previous_date is not null and r.t ->> 'date' < previous_date then
        problems := problems || format('timeline_order $.timeline[%s].date', r.idx);
      end if;
      previous_date := r.t ->> 'date';
    end if;
  end loop;
  select count(*) into current_count
  from jsonb_array_elements(story -> 'timeline') as t
  where t ->> 'status' = 'current';
  if current_count <> 1 then
    problems := problems || 'timeline_current_count $.timeline'::text;
  end if;

  -- featured stories are full explainers
  if (story ->> 'featured')::boolean then
    if jsonb_array_length(story -> 'meaning') < 2 then
      problems := problems || 'featured_meaning $.meaning'::text;
    end if;
    if jsonb_array_length(story -> 'affects') < 2 then
      problems := problems || 'featured_affects $.affects'::text;
    end if;
    if (select count(distinct e ->> 'step') from jsonb_array_elements(story -> 'evidence') as e) < 4 then
      problems := problems || 'featured_evidence $.evidence'::text;
    end if;
    if jsonb_array_length(story -> 'participate') < 1 then
      problems := problems || 'featured_participate $.participate'::text;
    end if;
    if coalesce(jsonb_array_length(story -> 'changes'), 0) = 0
       and coalesce(jsonb_array_length(story -> 'keyNumbers'), 0) = 0 then
      problems := problems || 'featured_numbers $'::text;
    end if;
  end if;

  -- links to other stories (existing ones; the site hides links to unpublished ones) and channels
  for r in
    select i - 1 as idx, v #>> '{}' as id
    from jsonb_array_elements(coalesce(story -> 'relatedStoryIds', '[]')) with ordinality as x(v, i)
  loop
    if r.id <> story ->> 'id'
       and not exists (select 1 from public.stories s where s.id = r.id) then
      problems := problems || format('unknown_related $.relatedStoryIds[%s]', r.idx);
    end if;
  end loop;
  for r in
    select i - 1 as idx, p ->> 'channel' as channel
    from jsonb_array_elements(story -> 'participate') with ordinality as x(p, i)
  loop
    if not exists (select 1 from public.channels c where c.id = r.channel) then
      problems := problems || format('unknown_channel $.participate[%s].channel', r.idx);
    end if;
  end loop;

  return problems;
end;
$$;

/** The public snapshot of a story: no reviewer notes, no `draft` flag. */
create function private.published_content(story jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$ select private.strip_notes(story) - 'draft' $$;

/** Problems of a working copy as it would be published (staff; used by the admin as a check). */
create function public.story_problems(p_content jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('editor');
  return private.story_problems(p_content);
end;
$$;

revoke execute on function public.story_problems(jsonb) from public, anon;
grant execute on function public.story_problems(jsonb) to authenticated;
