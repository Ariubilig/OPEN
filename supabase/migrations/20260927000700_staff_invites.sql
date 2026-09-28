-- Adding people to the team. The invite-staff edge function calls these with the admin's own
-- session (so the admin check runs here) and uses the service role only to send the invitation.

/** The auth account with this email, or null (admins only). */
create function public.staff_user_id_by_email(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');
  return (select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1);
end;
$$;

/** Give an existing auth account a place on the team, or change its name and role (admins only). */
create function public.add_staff(p_user_id uuid, p_name text, p_role public.staff_role)
returns public.staff
language plpgsql
security definer
set search_path = ''
as $$
declare
  member public.staff;
begin
  perform private.require_role('admin');
  if length(btrim(coalesce(p_name, ''))) not between 1 and 100 then
    raise exception 'invalid_name' using errcode = 'PT400';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'not_found' using errcode = 'PT404';
  end if;
  if p_role <> 'admin' then
    perform private.assert_not_last_admin(p_user_id);
  end if;
  insert into public.staff (user_id, name, role)
  values (p_user_id, btrim(p_name), p_role)
  on conflict (user_id) do update set name = excluded.name, role = excluded.role
  returning * into member;
  return member;
end;
$$;

revoke execute on function public.staff_user_id_by_email(text),
  public.add_staff(uuid, text, public.staff_role)
  from public, anon;
grant execute on function public.staff_user_id_by_email(text),
  public.add_staff(uuid, text, public.staff_role)
  to authenticated;
