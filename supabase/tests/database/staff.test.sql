-- Team administration. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'only.admin@test.local'),
  ('00000000-0000-4000-8000-0000000000a2', 'editor@test.local'),
  ('00000000-0000-4000-8000-0000000000a3', 'newcomer@test.local');
-- the seed's admin would make "last admin" untestable: this test works on its own team
delete from public.staff;
insert into public.staff (user_id, name, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'Only Admin', 'admin'),
  ('00000000-0000-4000-8000-0000000000a2', 'Editor', 'editor');

select ok(
  not has_function_privilege('anon', 'public.add_staff(uuid, text, public.staff_role)', 'execute')
  and not has_function_privilege('anon', 'public.staff_user_id_by_email(text)', 'execute'),
  'anon cannot execute team functions'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a2", "role": "authenticated"}';
select throws_ok(
  $$ select public.staff_user_id_by_email('newcomer@test.local') $$, 'PT403', 'forbidden',
  'an editor cannot look up accounts'
);
select throws_ok(
  $$ select public.add_staff('00000000-0000-4000-8000-0000000000a3', 'X', 'admin') $$,
  'PT403', 'forbidden', 'an editor cannot add people'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000000a1", "role": "authenticated"}';
select is(
  public.staff_user_id_by_email(' NewComer@test.local '),
  '00000000-0000-4000-8000-0000000000a3'::uuid,
  'an admin finds an account by email, ignoring case and spaces'
);
select is(
  public.staff_user_id_by_email('nobody@test.local'), null, 'no account → null'
);
select is(
  (select role::text from public.add_staff('00000000-0000-4000-8000-0000000000a3', ' Шинэ хүн ', 'reviewer')),
  'reviewer', 'an admin adds an existing account to the team'
);
select is(
  (select name from public.staff where user_id = '00000000-0000-4000-8000-0000000000a3'),
  'Шинэ хүн', 'names are trimmed'
);
select throws_ok(
  $$ select public.set_staff_role('00000000-0000-4000-8000-0000000000a1', 'editor') $$,
  'PT409', 'last_admin', 'the last admin cannot step down'
);
select throws_ok(
  $$ select public.remove_staff('00000000-0000-4000-8000-0000000000a1') $$,
  'PT409', 'last_admin', 'the last admin cannot be removed'
);
select lives_ok(
  $$ select public.remove_staff('00000000-0000-4000-8000-0000000000a2') $$,
  'an admin removes a member'
);
reset role;

select * from finish();
rollback;
