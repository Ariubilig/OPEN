// Writes two files from the seed JSON in supabase/seed/. Run: npm run db:seed
//
// supabase/seed.sql — local development; `supabase db reset` loads it after the migrations:
//  - three local staff accounts (sign in with a code sent to the local inbox, Mailpit)
//  - channels and tax rules, local settings
//  - every story as a working copy with its history; non-draft stories also published
//
// supabase/bootstrap.sql — a new production database, run once after `supabase db push`:
//  - channels and tax rules
//  - every story as a draft working copy, for the team to check and publish (two people)
//  - no accounts and no settings (the first admin and the URLs are set during the deploy)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SEED = join(ROOT, 'supabase/seed')
const OUT = join(ROOT, 'supabase/seed.sql')
const BOOTSTRAP = join(ROOT, 'supabase/bootstrap.sql')

export const SEED_STAFF = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'admin@tod.test',
    name: 'Туршилтын админ',
    role: 'admin',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    email: 'editor@tod.test',
    name: 'Туршилтын редактор',
    role: 'editor',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    email: 'reviewer@tod.test',
    name: 'Туршилтын хянагч',
    role: 'reviewer',
  },
] as const

const [, editor, reviewer] = SEED_STAFF

const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(join(SEED, file), 'utf8'))

/** A dollar-quoted JSON literal; the tag never occurs in the seed text. */
function jsonb(value: unknown): string {
  const text = JSON.stringify(value)
  if (text.includes('$seed$')) throw new Error('seed text contains $seed$')
  return `$seed$${text}$seed$::jsonb`
}

const quote = (s: string | null) =>
  s === null ? 'null' : `'${s.replaceAll("'", "''")}'`

function seedUser(u: (typeof SEED_STAFF)[number]): string {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', ${quote(u.id)}, 'authenticated', 'authenticated',
  ${quote(u.email)}, '', now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values (
  ${quote(u.id)}, ${quote(u.id)},
  jsonb_build_object('sub', ${quote(u.id)}, 'email', ${quote(u.email)}, 'email_verified', true),
  'email', now(), now()
);
insert into public.staff (user_id, name, role) values (${quote(u.id)}, ${quote(u.name)}, ${quote(u.role)});`
}

/**
 * A working copy with its history; published ones also get the public snapshot.
 * Seed statements are all parsed before any of them runs, so there is no helper function:
 * one self-contained block per story.
 */
function seedStory(
  doc: unknown,
  published: boolean,
  at: string,
  author: string | null = editor.id,
): string {
  const publish = published
    ? `
  insert into public.story_revisions (story_id, content, action, author, created_at)
  values (story_id, doc, 'publish', ${quote(reviewer.id)}, at)
  returning id into revision;
  insert into public.published_stories
    (id, content, revision_id, first_published_at, published_at, published_by)
  values (story_id, private.published_content(doc), revision, at, at, ${quote(reviewer.id)});`
    : ''
  return `do $do$
declare
  doc jsonb := ${jsonb(doc)} - 'draft';
  story_id text := doc ->> 'id';
  at timestamptz := ${quote(at)};
  revision bigint;
begin
  if exists (select 1 from public.stories where id = story_id) then
    return;
  end if;
  insert into public.stories (id, content, state, created_by, created_at, updated_by, updated_at)
  values (
    story_id, doc, ${quote(published ? 'published' : 'draft')},
    ${quote(author)}, at, ${quote(author)}, at
  );
  insert into public.story_revisions (story_id, content, action, note, author, created_at)
  values (story_id, doc, 'import', 'supabase/seed', ${quote(author)}, at);${publish}
end
$do$;`
}

const channels = readJson('channels.json') as { id: string }[]
const channelRows = channels.map(
  (c, i) => `  (${quote(c.id)}, ${i + 1}, ${jsonb(c)})`,
)

const storyFiles = readdirSync(join(SEED, 'stories'))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort()
  .map((file) => {
    const doc = readJson(`stories/${file}`) as {
      draft?: boolean
      publishedAt?: string
    }
    // noon in Ulaanbaatar on the story's publication date
    return { file, doc, at: `${doc.publishedAt ?? '2026-01-01'} 12:00+08` }
  })
const stories = storyFiles.map(
  ({ file, doc, at }) =>
    `-- ${file}\n${seedStory(doc, doc.draft !== true, at)}`,
)
// production: drafts without an author ("Систем" in the history), nothing published yet
const draftStories = storyFiles.map(
  ({ file, doc, at }) => `-- ${file}\n${seedStory(doc, false, at, null)}`,
)

const sql = `-- generated by scripts/gen-seed.ts — do not edit; run \`npm run db:seed\`
-- Local development data. Staff sign in at /admin with a code from the local inbox (Mailpit).

${SEED_STAFF.map(seedUser).join('\n\n')}

insert into public.channels (id, sort_order, content) values
${channelRows.join(',\n')};

insert into public.tax_rules (id, content) values ('pit', ${jsonb(readJson('taxRules.json'))});

-- the database reaches the edge functions through the gateway container on the Docker network
update public.settings
set site_url = 'http://localhost:5173',
    functions_url = 'http://supabase_kong_tod:8000/functions/v1';

${stories.join('\n\n')}
`

writeFileSync(OUT, sql)

const bootstrap = `-- generated by scripts/gen-seed.ts — do not edit; run \`npm run db:seed\`
-- First data for a new production database. Run it once after \`supabase db push\` (SQL editor
-- or psql); running it again adds nothing. No accounts, no settings: see README "Deploy".

insert into public.channels (id, sort_order, content) values
${channelRows.join(',\n')}
on conflict (id) do nothing;

insert into public.tax_rules (id, content) values ('pit', ${jsonb(readJson('taxRules.json'))})
on conflict (id) do nothing;

${draftStories.join('\n\n')}
`

writeFileSync(BOOTSTRAP, bootstrap)
console.log(
  `wrote supabase/seed.sql — ${SEED_STAFF.length} staff, ${channels.length} channels, ${stories.length} stories`,
)
console.log(
  `wrote supabase/bootstrap.sql — ${channels.length} channels, ${draftStories.length} draft stories`,
)
