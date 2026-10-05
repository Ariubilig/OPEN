-- Email alerts. Run: npm run db:test
-- Works next to whatever the local database already holds: its own address, its own story.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- no network calls from the triggers during the test
update open.settings set functions_url = null;
-- emails already waiting in the local database are left alone
update open.email_outbox set status = 'sent' where status in ('pending', 'sending');

insert into open.stories (id, content) values ('alert-test', $json${"id":"alert-test","type":"Хуулийн төсөл","stage":"Өргөн мэдүүлсэн","topics":["Татвар"],"featured":false,"title":"Туршилтын төсөл","officialTitle":{"text":"Жишээ","source":"s1"},"summary":{"text":"Товч","source":"s1"},"publishedAt":"2026-01-01","timeline":[{"date":"2026-01-01","label":"Өргөн мэдүүлсэн","status":"current","source":"s1"}],"meaning":[],"affects":[],"evidence":[],"participate":[],"sources":[{"id":"s1","title":"Эх","publisher":"parliament.mn","url":"https://parliament.mn/x","accessedAt":"2026-01-01","kind":"official"}]}$json$);
insert into open.story_revisions (story_id, content, action) select id, content, 'publish' from open.stories where id = 'alert-test';
insert into open.published_stories (id, content, revision_id)
select id, content, (select max(id) from open.story_revisions where story_id = 'alert-test')
from open.stories where id = 'alert-test';

create temporary view test_outbox as
  select * from open.email_outbox where data ->> 'story_id' = 'alert-test';

set local role anon;
set local request.headers = '{"x-real-ip": "198.51.100.4"}';
select lives_ok(
  $$ select open.subscribe(' Alert.Reader@Example.MN ', 'alert-test') $$,
  'a reader can follow a story'
);
select throws_ok($$ select open.subscribe('nope', 'alert-test') $$, 'PT400', 'invalid_input', 'the address must look like one');
select throws_ok($$ select open.subscribe('a@b.mn', 'missing') $$, 'PT404', 'not_found', 'only published stories');
select throws_ok($$ select * from open.subscribers $$, '42501', null, 'readers cannot read addresses');
select throws_ok($$ select * from open.email_outbox $$, '42501', null, 'readers cannot read the outbox');
reset role;

select is(
  (select array_agg(template || ':' || to_email) from test_outbox),
  array['confirm:alert.reader@example.mn'],
  'the first follow sends one confirmation, to the normalized address'
);

-- the stage changes before confirmation: nothing goes to an unconfirmed address
update open.published_stories set content = jsonb_set(content, '{stage}', to_jsonb('Хэлэлцэх эсэх'::text)) where id = 'alert-test';
select is((select count(*)::int from test_outbox where template = 'stage_change'), 0, 'unconfirmed addresses get no alerts');

-- the token as the email carries it (readers cannot look it up)
create temporary table test_token as
  select token from open.subscribers where email = 'alert.reader@example.mn';
grant select on test_token to anon;

set local role anon;
select is(
  open.confirm_subscription((select token from test_token)) -> 0 ->> 'id',
  'alert-test', 'the confirmation link activates the address and lists its stories'
);
select is(open.confirm_subscription(gen_random_uuid()), null, 'an unknown token confirms nothing');
reset role;

update open.published_stories set content = jsonb_set(content, '{stage}', to_jsonb('Анхны хэлэлцүүлэг'::text)) where id = 'alert-test';
select is(
  (select data ->> 'old_stage' || ' → ' || (data ->> 'new_stage') from test_outbox where template = 'stage_change'),
  'Хэлэлцэх эсэх → Анхны хэлэлцүүлэг', 'a stage change queues an alert with both stages'
);
update open.published_stories set content = jsonb_set(content, '{title}', to_jsonb('Шинэ гарчиг'::text)) where id = 'alert-test';
select is((select count(*)::int from test_outbox where template = 'stage_change'), 1, 'other edits send nothing');

-- delivery (service role)
set local role service_role;
select is((select count(*)::int from open.claim_emails(10)), 2, 'the sender claims both emails');
select is((select count(*)::int from open.claim_emails(10)), 0, 'a claimed email is not claimed twice');
select open.finish_email((select min(id) from open.email_outbox where data ->> 'story_id' = 'alert-test'), 'failed', 'boom');
reset role;
select is(
  (select status from test_outbox order by id limit 1), 'pending', 'a failed email is tried again'
);

set local role anon;
select ok(
  open.unsubscribe((select token from test_token), 'alert-test'),
  'unsubscribing from the only story'
);
reset role;
select is(
  (select count(*)::int from open.subscribers where email = 'alert.reader@example.mn'), 0,
  'an address that follows nothing is deleted'
);

select * from finish();
rollback;
