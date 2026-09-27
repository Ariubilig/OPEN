-- Reader features: error reports and search. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- a published story to report on (the seed may or may not be loaded: make our own)
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'r@test.local');
insert into public.staff (user_id, name, role) values ('00000000-0000-4000-8000-0000000000b1', 'Editor', 'editor');
insert into public.stories (id, content) values ('reader-test', $json${"id":"reader-test","type":"Хууль","stage":"Батлагдсан","topics":["Татвар"],"featured":false,"title":"Шинэчилсэн зохицуулалт","officialTitle":{"text":"Жишээ хууль","source":"s1"},"summary":{"text":"Товч","source":"s1"},"publishedAt":"2026-01-01","timeline":[{"date":"2026-01-01","label":"Баталсан","status":"current","source":"s1"}],"meaning":[],"affects":[],"evidence":[],"participate":[],"sources":[{"id":"s1","title":"Эх","publisher":"legalinfo.mn","url":"https://legalinfo.mn/x","accessedAt":"2026-01-01","kind":"official"}]}$json$);
insert into public.story_revisions (story_id, content, action) select id, content, 'publish' from public.stories where id = 'reader-test';
insert into public.published_stories (id, content, revision_id)
select id, content, (select max(id) from public.story_revisions where story_id = 'reader-test')
from public.stories where id = 'reader-test';

-- readers (as PostgREST calls them: role anon, with request headers)
set local role anon;
set local request.headers = '{"x-real-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9, 203.0.113.7"}';
select lives_ok(
  $$ select public.submit_report('reader-test', '  Огноо буруу байна.  ', 'me@example.mn') $$,
  'a reader can report an error'
);
select throws_ok(
  $$ select public.submit_report('reader-test', 'x') $$, 'PT400', 'invalid_input',
  'a report needs a few words'
);
select throws_ok(
  $$ select public.submit_report('no-such-story', 'Огноо буруу байна.') $$, 'PT404', 'not_found',
  'reports are only for published stories'
);
select throws_ok($$ select * from public.reports $$, '42501', null, 'readers cannot read reports');
select is(private.client_address(), '203.0.113.7', 'the address is the gateway''s, not the client''s header');
select is(
  (select array_agg(id) from public.search_stories('ШИНЭЧИЛ')),
  array['reader-test'], 'search matches word prefixes, any case'
);
select is(
  (select count(*)::int from public.search_stories('шинэчилсэн жишээ')), 1,
  'every word must match (title and official title)'
);
select is((select count(*)::int from public.search_stories('?! ')), 0, 'no words, no results');
reset role;

-- the 11th report from one address within the hour is refused
select lives_ok(
  $$ do $d$ begin for i in 1..9 loop perform set_config('role', 'anon', true);
     perform public.submit_report('reader-test', 'Эх сурвалж зөрж байна.'); end loop; end $d$ $$,
  'ten reports an hour are fine'
);
set local role anon;
select throws_ok(
  $$ select public.submit_report('reader-test', 'Эх сурвалж зөрж байна.') $$, 'PT429', 'rate_limited',
  'too many reports from one address'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000b1", "role": "authenticated"}';
select is(
  (select contact from public.reports where story_id = 'reader-test' order by id limit 1),
  'me@example.mn', 'staff read reports; text is trimmed'
);
select is(
  (select status from public.resolve_report(
    (select min(id) from public.reports where story_id = 'reader-test'), 'resolved', 'Зассан')),
  'resolved', 'staff resolve a report'
);
reset role;

select * from finish();
rollback;
