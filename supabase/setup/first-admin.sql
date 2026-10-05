-- The first admin of a new project (docs/SUPABASE_SETUP.md, step 6). Hand-written, run once.
--
-- Before running: add yourself under Authentication → Users ("Add user" → "Send invitation"),
-- then replace the two values below with your email address and the name the team will see.
-- Everyone else is invited later from the admin (/admin → Тохиргоо → Редакцын баг).

do $$
declare
  admin_email text := 'you@example.mn';   -- ← the address you added under Authentication → Users
  admin_name text := 'Your name';         -- ← shown in the admin and as the reviewer of stories
  admin_id uuid;
begin
  if admin_email = 'you@example.mn' or admin_name = 'Your name' then
    raise exception 'Replace admin_email and admin_name at the top of this file first.';
  end if;
  select id into admin_id from auth.users where lower(email) = lower(btrim(admin_email));
  if admin_id is null then
    raise exception 'No account with the email %. Add it under Authentication → Users first.',
      admin_email;
  end if;
  insert into open.staff (user_id, name, role)
  values (admin_id, btrim(admin_name), 'admin')
  on conflict (user_id) do update set name = excluded.name, role = 'admin';
  raise notice 'Admin added: % (%)', admin_name, admin_email;
end
$$;

-- Check: you should see one row with role "admin".
select s.name, s.role, u.email
from open.staff s
join auth.users u on u.id = s.user_id;
