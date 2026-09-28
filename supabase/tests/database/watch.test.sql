-- Document watcher. Run: npm run db:test
-- Works next to whatever the local database already holds: its own pages, its own people.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'watch.editor@test.local'),
  ('00000000-0000-4000-8000-0000000000e2', 'watch.stranger@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'Watch Editor', 'editor');
-- pages already in the local database are not due during this test
update public.watched_documents set last_checked_at = now();

select ok(
  private.is_watchable_url('https://legalinfo.mn/mn/detail?lawId=1')
  and private.is_watchable_url('https://d.parliament.mn')
  and private.is_watchable_url('https://xn--h1aax.xn--l1acc/x')
  and not private.is_watchable_url('http://legalinfo.mn/')
  and not private.is_watchable_url('https://127.0.0.1/')
  and not private.is_watchable_url('https://localhost/')
  and not private.is_watchable_url('https://legalinfo.mn:8443/')
  and not private.is_watchable_url('https://user@legalinfo.mn/'),
  'only public https pages can be watched'
);

set local role anon;
select throws_ok($$ select * from public.watched_documents $$, '42501', null, 'readers cannot see the watch list');
reset role;
-- (calling a function anon may not execute is checked by privilege: see docs/PLAN.md, risks)
select ok(
  not has_function_privilege('anon', 'public.add_watched_document(text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.mark_watch_events_seen(bigint[])', 'execute'),
  'readers cannot change the watch list'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e2", "role": "authenticated"}';
select throws_ok(
  $$ select public.add_watched_document('https://example.mn/a', 'A') $$, 'PT403', 'forbidden',
  'people outside the team cannot add pages'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select is(
  (public.add_watched_document(' https://watch-test.mn/bill ', ' Туршилтын төсөл ')).label,
  'Туршилтын төсөл', 'an editor adds a page (trimmed)'
);
select throws_ok(
  $$ select public.add_watched_document('https://watch-test.mn/bill', 'Дахин') $$, 'PT409', 'url_taken',
  'a page is watched once'
);
select throws_ok(
  $$ select public.add_watched_document('https://10.0.0.1/', 'IP') $$, 'PT400', 'invalid_input',
  'an IP address is refused'
);
select throws_ok(
  $$ select public.add_watched_document('https://watch-test.mn/other', 'X', 'no-such-story') $$,
  'PT404', 'not_found', 'the linked story must exist'
);
select throws_ok(
  $$ update public.watched_documents set label = 'x' $$, '42501', null,
  'staff change pages only through the functions'
);
select public.add_watched_document('https://watch-test.mn/paused', 'Түр зогсоосон');
select public.update_watched_document(
  (select id from public.watched_documents where url = 'https://watch-test.mn/paused'),
  'Түр зогсоосон', null, false
);
reset role;

create temporary view test_docs as
  select * from public.watched_documents where url like 'https://watch-test.mn/%';
create temporary table test_ids as select id, url from test_docs;
grant select on test_ids to service_role, authenticated;

select ok(
  not has_function_privilege('authenticated', 'public.claim_watched_documents(interval, bigint[], integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_watch_result(bigint, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.record_watch_result(bigint, text, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.record_watch_result(bigint, text, text, text)', 'execute'),
  'only the service role claims pages and records results'
);

set local role service_role;
select is(
  (select array_agg(url) from public.claim_watched_documents('20 hours')),
  array['https://watch-test.mn/bill'], 'the schedule claims active pages that are due'
);
select is(
  (select count(*)::int from public.claim_watched_documents('20 hours')), 0,
  'a claimed page is not claimed again'
);
select is(
  (select array_agg(url) from public.claim_watched_documents('0 seconds',
    array[(select id from test_ids where url = 'https://watch-test.mn/paused')])),
  array['https://watch-test.mn/paused'], 'staff can check one page on its own, even a paused one'
);

select is(
  public.record_watch_result((select id from test_ids where url = 'https://watch-test.mn/bill'), 'h1', 'Нэг'),
  'first', 'the first fetch sets the baseline'
);
select is(
  public.record_watch_result((select id from test_ids where url = 'https://watch-test.mn/bill'), 'h1', 'Нэг'),
  'unchanged', 'the same text is no change'
);
select is(
  public.record_watch_result((select id from test_ids where url = 'https://watch-test.mn/bill'), null, null, 'http_503'),
  'error', 'a failed fetch is recorded as an error'
);
select is(
  public.record_watch_result((select id from test_ids where url = 'https://watch-test.mn/bill'), 'h2', 'Хоёр'),
  'changed', 'a different text is a change'
);
reset role;

select is(
  (select old_text || ' → ' || new_text from public.watch_events
   where document_id = (select id from test_ids where url = 'https://watch-test.mn/bill')),
  'Нэг → Хоёр', 'the change keeps the old and the new text (an error in between changes nothing)'
);
select is(
  (select last_status || ':' || last_text || ':' || coalesce(last_error, '-') from test_docs
   where url = 'https://watch-test.mn/bill'),
  'changed:Хоёр:-', 'the page keeps the new text and clears the error'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000e1", "role": "authenticated"}';
select is(
  public.mark_watch_events_seen(array(
    select e.id from public.watch_events e join test_ids t on t.id = e.document_id
  )),
  1, 'an editor marks the change seen'
);
reset role;

select * from finish();
rollback;
