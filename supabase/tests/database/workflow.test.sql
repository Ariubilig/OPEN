-- Access and editorial workflow. Run: npm run db:test (supabase test db)
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- ---- fixtures (as postgres) --------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'editor@test.local'),
  ('00000000-0000-4000-8000-0000000000e2', 'reviewer@test.local'),
  ('00000000-0000-4000-8000-0000000000e3', 'admin@test.local'),
  ('00000000-0000-4000-8000-0000000000e4', 'outsider@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'Editor One', 'editor'),
  ('00000000-0000-4000-8000-0000000000e2', 'Reviewer Two', 'reviewer'),
  ('00000000-0000-4000-8000-0000000000e3', 'Admin Three', 'admin');

create temporary table fixture (doc jsonb) on commit drop;
insert into fixture values ($json${
  "id": "t-story",
  "type": "Хууль",
  "stage": "Батлагдсан",
  "topics": ["Татвар"],
  "featured": false,
  "title": "Тест мэдээ",
  "officialTitle": { "text": "Тест хууль", "source": "s1" },
  "summary": { "text": "Товч агуулга", "source": "s1", "verify": "note for the team" },
  "publishedAt": "2026-01-01",
  "timeline": [{ "date": "2026-01-01", "label": "Баталсан", "status": "current", "source": "s1" }],
  "meaning": [{ "text": "Утга", "source": "s1" }],
  "affects": [],
  "evidence": [],
  "participate": [],
  "sources": [{
    "id": "s1", "title": "Эх сурвалж", "publisher": "legalinfo.mn",
    "url": "https://legalinfo.mn/mn/detail?lawId=1", "accessedAt": "2026-01-01", "kind": "official"
  }],
  "verify": ["team note"]
}$json$);
grant select on fixture to anon, authenticated;

-- ---- anonymous readers -------------------------------------------------------------------------

-- Privileges are checked with has_function_privilege(): in the local Postgres build
-- (supabase/postgres 17.6.1.106) a denied function call after SET ROLE in a superuser session
-- crashes the backend. Through the API (PostgREST) the same call returns a clean 42501.
select ok(
  not has_function_privilege('anon', 'public.create_story(text, jsonb, public.revision_action)', 'execute')
  and not has_function_privilege('anon', 'public.publish_story(text, integer, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.list_staff()', 'execute'),
  'anon cannot execute staff functions'
);

set local role anon;
select throws_ok($$ select * from public.stories $$, '42501', null, 'anon cannot read working copies');
select throws_ok($$ select * from public.settings $$, '42501', null, 'anon cannot read settings');
select lives_ok($$ select public.get_channels() $$, 'anon can read channels through get_channels()');
reset role;

-- ---- signed-in, not staff ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e4", "role": "authenticated"}';
select throws_ok(
  $$ select public.create_story('t-story', (select doc from fixture)) $$, 'PT403', 'forbidden',
  'a signed-in user without a staff row cannot create stories'
);
select is_empty('select * from public.staff', 'a non-staff user cannot list staff');
reset role;

-- ---- editor creates and saves ------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select lives_ok(
  $$ select public.create_story('t-story', (select doc from fixture)) $$,
  'an editor can create a story'
);
select is(
  (select state::text from public.stories where id = 't-story'), 'draft', 'a new story is a draft'
);
select throws_ok(
  $$ select public.create_story('t-story', (select doc from fixture)) $$, 'PT409', 'id_taken',
  'story ids are unique'
);
select throws_ok(
  $$ select public.create_story('Bad Id', '{}'::jsonb) $$, 'PT400', 'invalid_id',
  'story ids are slugs'
);
select throws_ok(
  $$ select public.save_story('t-story', (select doc from fixture), 7) $$, 'PT409', 'version_conflict',
  'saving with a stale version is a conflict'
);
select is(
  (select version from public.save_story('t-story',
    (select jsonb_set(doc, '{title}', '"Тест мэдээ 2"') from fixture), 1)),
  2, 'saving bumps the version'
);
select is(
  (select version from public.save_story('t-story',
    (select jsonb_set(doc, '{title}', '"Тест мэдээ 2"') from fixture), 2)),
  2, 'saving the same content changes nothing'
);
select throws_ok(
  $$ select public.publish_story('t-story', 2) $$, 'PT403', 'forbidden',
  'an editor cannot publish'
);
select throws_ok(
  $$ select public.request_changes('t-story', 2, 'fix') $$, 'PT403', 'forbidden',
  'an editor cannot request changes'
);
select is(
  (select state::text from public.submit_story('t-story', 2, 'ready')), 'in_review',
  'submitting puts the story in review'
);
select throws_ok(
  $$ select public.update_my_name('') $$, 'PT400', 'invalid_name', 'names cannot be empty'
);
reset role;

-- ---- reviewer: request changes, two-person rule, publish ---------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select throws_ok(
  $$ select public.request_changes('t-story', 3, '  ') $$, 'PT400', 'note_required',
  'requesting changes needs a note'
);
select is(
  (select state::text from public.request_changes('t-story', 3, 'Эх сурвалжийг шалгана уу')),
  'changes_requested', 'a reviewer can send a story back'
);
select is(
  (select review_note from public.stories where id = 't-story'), 'Эх сурвалжийг шалгана уу',
  'the review note is kept on the story'
);
-- the reviewer edits the text themselves: now they cannot also publish it
select lives_ok(
  $$ select public.save_story('t-story',
       (select jsonb_set(doc, '{title}', '"Тест мэдээ 3"') from fixture), 4) $$,
  'a reviewer can edit'
);
select throws_ok(
  $$ select public.publish_story('t-story', 5) $$, 'PT403', 'same_person',
  'the last person who changed the content cannot publish it'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e3", "role": "authenticated"}';
select throws_ok(
  $$ select public.publish_story('t-story', 5, null, 'first correction') $$,
  'PT400', 'correction_before_publish', 'a first publish cannot carry a correction'
);
select lives_ok(
  $$ select public.publish_story('t-story', 5, 'checked against legalinfo.mn') $$,
  'a second person can publish'
);
select is(
  (select state::text from public.stories where id = 't-story'), 'published',
  'publishing marks the working copy published'
);
select is(
  (select content -> 'reviewed' ->> 'by' from public.published_stories where id = 't-story'),
  'Admin Three', 'the publisher is recorded as the reviewer'
);
select is(
  (select content ->> 'publishedAt' from public.published_stories where id = 't-story'),
  private.today_ub(), 'the first publish sets publishedAt to today'
);
select ok(
  (select content::text not like '%"verify"%' from public.published_stories where id = 't-story'),
  'the public snapshot has no reviewer notes'
);
select ok(
  (select content #>> '{summary,verify}' = 'note for the team' from public.stories where id = 't-story'),
  'the working copy keeps its reviewer notes'
);
select throws_ok(
  $$ select public.publish_story('t-story', 6) $$, 'PT409', 'already_published',
  'publishing an unchanged story again is refused'
);
reset role;

-- ---- anon sees the snapshot --------------------------------------------------------------------

set local role anon;
select is(
  (select title from public.story_cards where id = 't-story'), 'Тест мэдээ 3',
  'anon reads the published card'
);
select throws_ok($$ select * from public.story_revisions $$, '42501', null, 'anon cannot read revisions');
reset role;

-- ---- republish with a correction, broken sources, unpublish, restore ---------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select is(
  (select state::text from public.save_story('t-story',
    (select jsonb_set(content, '{meaning,0,source}', '"missing"') from public.stories where id = 't-story'), 6)),
  'draft', 'editing a published story makes it a draft again'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select throws_ok(
  $$ select public.publish_story('t-story', 7) $$, 'PT422', 'story_problems',
  'a reference to an unknown source blocks publishing'
);
select is(
  (select content #>> '{meaning,0,source}' from public.published_stories where id = 't-story'), 's1',
  'the live snapshot is untouched by a failed publish'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select lives_ok(
  $$ select public.save_story('t-story',
       (select jsonb_set(content, '{meaning,0,source}', '"s1"') from public.stories where id = 't-story'), 7) $$,
  'the editor fixes the source'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select lives_ok(
  $$ select public.publish_story('t-story', 8, null, 'Эх сурвалжийн холбоосыг зассан.') $$,
  'republishing with a correction'
);
select is(
  (select content #>> '{corrections,0,text}' from public.published_stories where id = 't-story'),
  'Эх сурвалжийн холбоосыг зассан.', 'the correction is shown with the story'
);
select is(
  (select content ->> 'updatedAt' from public.published_stories where id = 't-story'),
  private.today_ub(), 'a republish sets updatedAt'
);
select lives_ok(
  $$ select public.unpublish_story('t-story', 9, 'Хуулийг хүчингүй болгосон') $$,
  'a reviewer can unpublish'
);
reset role;

set local role anon;
select is_empty(
  $$ select * from public.published_stories where id = 't-story' $$,
  'an unpublished story is gone for readers'
);
reset role;

select is(
  (select array_agg(action::text order by id) from public.story_revisions where story_id = 't-story'),
  array['create', 'save', 'submit', 'request_changes', 'save', 'publish', 'save', 'save', 'publish', 'unpublish'],
  'every step is in the history'
);

select * from finish();
rollback;
