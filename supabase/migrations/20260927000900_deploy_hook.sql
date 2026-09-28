-- Rebuild the static site when what readers see changes: every publish, republish or unpublish
-- calls the host's build hook (settings.deploy_hook_url), so the prerendered link previews,
-- sitemap and RSS follow. One call per statement; nothing happens while no hook is set.

create extension if not exists pg_net with schema extensions;

create function private.call_deploy_hook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook text := (select deploy_hook_url from public.settings);
begin
  if hook is not null then
    -- asynchronous: the publish does not wait for the host
    perform net.http_post(url := hook, body := '{}'::jsonb, timeout_milliseconds := 10000);
  end if;
  return null;
end;
$$;

create trigger published_stories_deploy_hook
  after insert or update or delete on public.published_stories
  for each statement execute function private.call_deploy_hook();
