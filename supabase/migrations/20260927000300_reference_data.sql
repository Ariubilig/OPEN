-- Reference data shared by every story: official participation channels and the income tax
-- rules behind the calculator. Admins edit them; readers get them through get_channels() and
-- get_tax_rules(), which drop the team's `verify` notes.

create table open.channels (
  id text primary key,
  sort_order integer not null default 0,
  content jsonb not null check (content ->> 'id' = id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table open.channels is 'Official channels (ChannelSchema) a story can point readers to.';

create table open.tax_rules (
  id text primary key default 'pit' check (id = 'pit'),
  content jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
comment on table open.tax_rules is 'Personal income tax brackets (TaxRulesSchema), a single row.';

create trigger channels_touch before update on open.channels
  for each row execute function open_private.touch();
create trigger tax_rules_touch before update on open.tax_rules
  for each row execute function open_private.touch();

alter table open.channels enable row level security;
alter table open.tax_rules enable row level security;

create policy "staff can read channels" on open.channels
  for select to authenticated using ((select open_private.is_staff()));
create policy "admins can add channels" on open.channels
  for insert to authenticated with check ((select open_private.is_admin()));
create policy "admins can change channels" on open.channels
  for update to authenticated
  using ((select open_private.is_admin())) with check ((select open_private.is_admin()));
create policy "admins can remove channels" on open.channels
  for delete to authenticated using ((select open_private.is_admin()));

create policy "staff can read tax rules" on open.tax_rules
  for select to authenticated using ((select open_private.is_staff()));
create policy "admins can change tax rules" on open.tax_rules
  for update to authenticated
  using ((select open_private.is_admin())) with check ((select open_private.is_admin()));

revoke all on open.channels, open.tax_rules from anon;
revoke insert, delete, truncate on open.tax_rules from authenticated;

/** A copy of a JSON value with every `verify` key removed, at any depth. */
create function open_private.strip_notes(value jsonb)
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
        (select jsonb_object_agg(e.key, open_private.strip_notes(e.value))
         from jsonb_each(value) as e
         where e.key <> 'verify'),
        '{}'::jsonb
      );
    when 'array' then
      return coalesce(
        (select jsonb_agg(open_private.strip_notes(a.value) order by a.ord)
         from jsonb_array_elements(value) with ordinality as a(value, ord)),
        '[]'::jsonb
      );
    else
      return value;
  end case;
end;
$$;

create function open.get_channels()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(open_private.strip_notes(content) order by sort_order, id), '[]'::jsonb)
  from open.channels
$$;

create function open.get_tax_rules()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select open_private.strip_notes(content) from open.tax_rules where id = 'pit'
$$;

grant execute on function open.get_channels(), open.get_tax_rules() to anon, authenticated;
