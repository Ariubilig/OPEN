-- AI draft jobs. Run: npm run db:test
-- The ai-draft edge function writes the jobs with the service role; staff only read them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000d1', 'ai.editor@test.local'),
  ('00000000-0000-4000-8000-0000000000d2', 'ai.stranger@test.local');
insert into public.staff (user_id, name, role) values
  ('00000000-0000-4000-8000-0000000000d1', 'AI Editor', 'editor');

insert into public.ai_drafts (story_id, input, document_chars, created_by, created_at) values
  ('ai-test-fresh', '{}', 1200, '00000000-0000-4000-8000-0000000000d1', now() - interval '2 minutes'),
  ('ai-test-stale', '{}', 1200, '00000000-0000-4000-8000-0000000000d1', now() - interval '20 minutes');

select throws_ok(
  $$ insert into public.ai_drafts (story_id, input, document_chars) values ('Not A Slug', '{}', 1) $$,
  '23514', null, 'the story id must be a slug'
);

set local role anon;
select throws_ok($$ select * from public.ai_drafts $$, '42501', null, 'readers cannot see the jobs');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d2", "role": "authenticated"}';
select is(
  (select count(*)::int from public.ai_drafts where story_id like 'ai-test-%'), 0,
  'a signed-in person outside the team sees no jobs'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000d1", "role": "authenticated"}';
select is(
  (select count(*)::int from public.ai_drafts where story_id like 'ai-test-%'), 2,
  'staff see the jobs'
);
select throws_ok(
  $$ insert into public.ai_drafts (story_id, input, document_chars) values ('ai-test-x', '{}', 1) $$,
  '42501', null, 'staff cannot write jobs directly'
);
reset role;

select ok(
  not has_function_privilege('anon', 'public.expire_ai_drafts()', 'execute')
  and not has_function_privilege('authenticated', 'public.expire_ai_drafts()', 'execute')
  and has_function_privilege('service_role', 'public.expire_ai_drafts()', 'execute'),
  'only the service role expires jobs'
);

set local role service_role;
select public.expire_ai_drafts();
reset role;
select is(
  (select status || ':' || coalesce(error, '') from public.ai_drafts where story_id = 'ai-test-stale'),
  'failed:timeout', 'a job running for more than 15 minutes is marked failed'
);
select is(
  (select status from public.ai_drafts where story_id = 'ai-test-fresh'),
  'running', 'a recent job keeps running'
);

select * from finish();
rollback;
