-- Reference data shared by every story: official participation channels and the income tax
-- rules behind the calculator. Admins edit them; readers get them through get_channels() and
-- get_tax_rules(), which drop the team's `verify` notes.

create table public.channels (
  id text primary key,
  sort_order integer not null default 0,
  content jsonb not null check (content ->> 'id' = id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.channels is 'Official channels (ChannelSchema) a story can point readers to.';

create table public.tax_rules (
  id text primary key default 'pit' check (id = 'pit'),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table public.tax_rules is 'Personal income tax brackets (TaxRulesSchema), a single row.';

create trigger channels_touch before update on public.channels
  for each row execute function private.touch();
create trigger tax_rules_touch before update on public.tax_rules
  for each row execute function private.touch();

alter table public.channels enable row level security;
alter table public.tax_rules enable row level security;

create policy "staff can read channels" on public.channels
  for select to authenticated using ((select private.is_staff()));
create policy "admins can add channels" on public.channels
  for insert to authenticated with check ((select private.is_admin()));
create policy "admins can change channels" on public.channels
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "admins can remove channels" on public.channels
  for delete to authenticated using ((select private.is_admin()));

create policy "staff can read tax rules" on public.tax_rules
  for select to authenticated using ((select private.is_staff()));
create policy "admins can change tax rules" on public.tax_rules
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.channels, public.tax_rules from anon;
revoke insert, delete, truncate on public.tax_rules from authenticated;

/** A copy of a JSON value with every `verify` key removed, at any depth. */
create function private.strip_notes(value jsonb)
returns jsonb
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
begin
  case jsonb_typeof(value)
    when 'object' then
      return coalesce(
        (select jsonb_object_agg(e.key, private.strip_notes(e.value))
         from jsonb_each(value) as e
         where e.key <> 'verify'),
        '{}'::jsonb
      );
    when 'array' then
      return coalesce(
        (select jsonb_agg(private.strip_notes(a.value) order by a.ord)
         from jsonb_array_elements(value) with ordinality as a(value, ord)),
        '[]'::jsonb
      );
    else
      return value;
  end case;
end;
$$;

create function public.get_channels()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.strip_notes(content) order by sort_order, id), '[]'::jsonb)
  from public.channels
$$;

create function public.get_tax_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.strip_notes(content) from public.tax_rules where id = 'pit'
$$;

grant execute on function public.get_channels(), public.get_tax_rules() to anon, authenticated;
