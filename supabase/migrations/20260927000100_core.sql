-- Core: extensions, the private helper schema, staff roles, site settings.
--
-- Conventions for every migration in this project:
--  * row-level security on every table in public; clients never write editorial tables directly
--  * functions use `set search_path = ''` and schema-qualify every name
--  * RPC errors: `raise exception '<code>' using errcode = 'PT<http status>'`; the admin maps
--    <code> to a Mongolian message (src/admin/errors.ts)

create extension if not exists pg_jsonschema with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Helpers that the API must not expose. PostgREST only serves the schemas in config.toml.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- ---- staff -------------------------------------------------------------------------------------

-- Ordered: a check for 'reviewer' also passes for 'admin'.
create type public.staff_role as enum ('editor', 'reviewer', 'admin');

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  role public.staff_role not null,
  created_at timestamptz not null default now()
);
comment on table public.staff is
  'People who may use /admin. A signed-in user without a row here has no access.';
alter table public.staff enable row level security;

create function private.my_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff where user_id = (select auth.uid())
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.my_role() is not null $$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(private.my_role() = 'admin', false) $$;

grant execute on function private.my_role(), private.is_staff(), private.is_admin()
  to anon, authenticated;

/** Raise 403 unless the signed-in user has at least `minimum`; returns their user id. */
create function private.require_role(minimum public.staff_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current public.staff_role := private.my_role();
begin
  if current is null or current < minimum then
    raise exception 'forbidden' using errcode = 'PT403', detail = minimum::text;
  end if;
  return (select auth.uid());
end;
$$;

create policy "staff can read staff" on public.staff
  for select to authenticated
  using ((select private.is_staff()));

-- Staff rows are written by the invite-staff edge function (service role) and the admin RPCs below.
revoke insert, update, delete, truncate on public.staff from anon, authenticated;

-- ---- settings (one row) ------------------------------------------------------------------------

create table public.settings (
  id boolean primary key default true check (id),
  require_two_person_review boolean not null default true,
  -- origin of the public site, e.g. https://tod.mn — links in emails, prerendered pages
  site_url text check (site_url ~ '^https?://[^\s/]+$'),
  -- base URL of the edge functions, used by database jobs (pg_net)
  functions_url text check (functions_url ~ '^https?://\S+[^/]$'),
  -- static host's build hook: called after every publish so link previews are rebuilt
  deploy_hook_url text check (deploy_hook_url ~ '^https://\S+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.settings is 'Site settings, a single row. Staff read, admins change.';
insert into public.settings default values;
alter table public.settings enable row level security;

create policy "staff can read settings" on public.settings
  for select to authenticated
  using ((select private.is_staff()));

create policy "admins can change settings" on public.settings
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke insert, delete, truncate on public.settings from anon, authenticated;
revoke all on public.settings from anon;

/** Keeps updated_at / updated_by current on tables staff edit directly. */
create function private.touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger settings_touch before update on public.settings
  for each row execute function private.touch();

-- ---- staff administration ----------------------------------------------------------------------

/** Every staff member with their sign-in email (admins only). */
create function public.list_staff()
returns table (
  user_id uuid,
  name text,
  role public.staff_role,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');
  return query
    select s.user_id, s.name, s.role, u.email::text, s.created_at, u.last_sign_in_at
    from public.staff s
    join auth.users u on u.id = s.user_id
    order by s.created_at;
end;
$$;

create function private.assert_not_last_admin(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.staff where user_id = target and role = 'admin')
     and (select count(*) from public.staff where role = 'admin') = 1 then
    raise exception 'last_admin' using errcode = 'PT409';
  end if;
end;
$$;

create function public.set_staff_role(p_user_id uuid, p_role public.staff_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');
  if p_role <> 'admin' then
    perform private.assert_not_last_admin(p_user_id);
  end if;
  update public.staff set role = p_role where user_id = p_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
end;
$$;

/** Removes access; the auth account stays but can do nothing (sign-up is off). */
create function public.remove_staff(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');
  perform private.assert_not_last_admin(p_user_id);
  delete from public.staff where user_id = p_user_id;
  if not found then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
end;
$$;

create function public.update_my_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('editor');
begin
  if length(btrim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'invalid_name' using errcode = 'PT400';
  end if;
  update public.staff set name = btrim(p_name) where user_id = uid;
end;
$$;

revoke execute on function public.list_staff(), public.set_staff_role(uuid, public.staff_role),
  public.remove_staff(uuid), public.update_my_name(text)
  from public, anon;
grant execute on function public.list_staff(), public.set_staff_role(uuid, public.staff_role),
  public.remove_staff(uuid), public.update_my_name(text)
  to authenticated;
