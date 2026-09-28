-- AI drafts: a staff member gives the ai-draft edge function one official document; Claude
-- writes a draft story from it in the background, saved as a working copy (revision 'ai_draft').
-- A human then checks every sentence, and a second person publishes. This table tracks the jobs.

create table public.ai_drafts (
  id bigint generated always as identity primary key,
  story_id text not null check (story_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(story_id) <= 80),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  -- what was asked: document type, stage, source details, instructions (not the document text)
  input jsonb not null,
  document_chars integer not null,
  model text,
  usage jsonb,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
comment on table public.ai_drafts is 'AI draft jobs (the ai-draft edge function writes them).';
create index ai_drafts_created_idx on public.ai_drafts (created_at desc);
create index ai_drafts_created_by_idx on public.ai_drafts (created_by);

alter table public.ai_drafts enable row level security;
create policy "staff can read ai drafts" on public.ai_drafts
  for select to authenticated using ((select private.is_staff()));
revoke all on public.ai_drafts from anon;
revoke insert, update, delete, truncate on public.ai_drafts from authenticated;

/**
 * A job that has been running for 15 minutes has been cut off (the function's time limit):
 * mark it failed so the admin stops waiting. Run by the ai-draft function before it starts one.
 */
create function public.expire_ai_drafts()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_drafts
  set status = 'failed', error = 'timeout', finished_at = now()
  where status = 'running' and created_at < now() - interval '15 minutes'
$$;

revoke execute on function public.expire_ai_drafts() from public, anon, authenticated;
grant execute on function public.expire_ai_drafts() to service_role;
