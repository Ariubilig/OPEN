# Тод — plain-language civic news

A mobile-first news site where every story is built from one official document of the State Great
Khural (УИХ) or the Government — a law, bill, resolution, regulation, budget or investment
project. Each story explains in plain Mongolian what changed, what it means, who it affects, what
it is based on (every sentence links to its source), where the document is in its process, and
how a citizen can respond through an official channel (D-Parliament, legalinfo.mn, E-Mongolia,
public petition). It started at the Open Parliament Hackathon 2026.

> **Тод бол бие даасан иргэний мэдээллийн платформ. УИХ, Засгийн газрын албан ёсны сайт биш.**
> Tod is an independent civic information platform, not an official site of the State Great
> Khural or the Government.

Project rules for anyone (or any AI) editing the code: [CLAUDE.md](CLAUDE.md). The plan and the
decisions behind it: [docs/PLAN.md](docs/PLAN.md).

## How it fits together

- **Site** (`src/`): React single-page app. It reads published stories from Supabase with the
  public key; `scripts/prerender.ts` writes a page per story after the build, so shared links get
  a title and a preview. Readers can search (in the feed, `?q=`), follow a document in this
  browser ("Дагах", localStorage) or by email when its stage changes, share a story, and report
  an error. "Шийдвэрүүд хаана явж байна?" on the feed lists the next dates and latest steps of
  every document, computed from the story timelines — nothing on the site is invented to look
  busy (CLAUDE.md rule 13).
- **Admin** (`/admin`, a separate chunk readers never download): staff sign in with a code sent
  by email. Editors write stories in forms with live checks; a second person publishes (the
  two-person rule); every change is a revision. Also: readers' error reports, AI draft, the
  document watcher, the team and settings.
- **Supabase**: Postgres with row-level security on every table; all editorial writes go through
  `security definer` functions that check the role and write a revision. A story is one JSON
  document checked against the same contract as the app (`src/data/schema.ts` → JSON Schema).
  Edge functions: `ai-draft` (Claude), `send-emails` (Resend), `watch-documents`,
  `invite-staff`. pg_cron runs the email retries and the watcher; pg_net calls the functions.

## Run locally

Needs Node 20+ and Docker.

```bash
npm install
npm run db:start   # local Supabase on ports 553xx; prints the keys
npm run db:reset   # apply supabase/migrations and load supabase/seed.sql
cp .env.example .env.local   # then paste the publishable key from db:start
npm run dev        # http://localhost:5173
```

- **Staff accounts** (from the seed): `admin@tod.test`, `reviewer@tod.test`, `editor@tod.test`.
  Sign in at <http://localhost:5173/admin>; the code arrives in the local inbox (Mailpit,
  <http://127.0.0.1:55324>), where the alert emails go too.
- **AI draft** locally: copy `supabase/functions/.env.example` to `supabase/functions/.env`, set
  `ANTHROPIC_API_KEY`, and restart (`supabase stop && supabase start`). Without a key the admin
  says AI draft is not configured. Each draft is a paid API call.

Scripts: `npm run build` (check + typecheck + build + prerender into `dist/`), `npm run preview`
(serve `dist/` at <http://localhost:4173>), `npm run typecheck`, `npm run test`,
`npm run db:test` (database tests), `npm run check` / `check:strict` (seed story files),
`npm run format`. Generated files — never edit them by hand: `npm run db:types`
(`src/data/database.types.ts`), `npm run db:seed` (`supabase/seed.sql`,
`supabase/bootstrap.sql`), `npm run db:json-schema` (the JSON Schema migration and
`supabase/functions/_shared/story-schema.json`), `npm run db:sql-editor`
(`supabase/setup/schema.sql`, every migration in one file; run it after adding a migration).

## Add a story

In the admin: **Мэдээ → Шинэ мэдээ** (from scratch or from a JSON file), or **AI ноорог** (paste
one official document; Claude writes a draft in which every sentence cites it). Then:

1. Fill the story from official sources only. Every sentence has a source; a value nobody has
   confirmed is `TODO_VERIFY` (the site shows a dashed "Баталгаажуулах" box, never raw text).
   Notes for the reviewer (`verify`) are never shown on the site.
2. The **Шалгалт** panel lists what blocks publishing, the open `TODO_VERIFY` values and the
   notes. The database runs the same rules again when a story is published.
3. **Хянуулахаар илгээх** → a reviewer compares it with what is live (**Сайтынхтай харьцуулах**)
   and publishes, or asks for changes. The person who last changed a story cannot publish it.
4. A published story can be corrected: publishing again with a correction note shows the note
   with its date.

The seed files in `supabase/seed/` (one story per file) are local test data; keep them readable
and don't reformat files you are not changing.

## Deploy

Replace `<ref>` with the Supabase project reference and `<domain>` with the site's address.

**Without the CLI or Docker:** [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) sets up the
project from the dashboard's SQL editor (`supabase/setup/schema.sql`, then `bootstrap.sql`, then
`supabase/setup/first-admin.sql`). The steps below are the CLI way.

**1. Database.** The project must be active (a paused free project is restored from the
dashboard first).

```bash
supabase link --project-ref <ref>
```

```bash
supabase db push
```

Then run `supabase/bootstrap.sql` once (Dashboard → SQL Editor, or `psql`): channels, tax rules
and the seed stories as drafts for the team to check. Never use `--include-seed` on production:
`seed.sql` holds the local test accounts.

**2. Edge functions and secrets.** `verify_jwt` settings come from `supabase/config.toml`.

```bash
supabase functions deploy --project-ref <ref>
```

```bash
supabase secrets set --project-ref <ref> ANTHROPIC_API_KEY=... RESEND_API_KEY=... "EMAIL_FROM=Тод <alerts@<domain>>"
```

See `supabase/functions/.env.example` for what each one does. Without `RESEND_API_KEY`, alert
emails are marked skipped; without `ANTHROPIC_API_KEY`, AI draft is off. The Resend sender
domain must be verified.

**3. Sign-in (Dashboard → Authentication).**

- Sign In / Providers → Email: on; "Allow new users to sign up": off (staff are invited).
- URL Configuration: Site URL `https://<domain>`; Redirect URLs `https://<domain>/admin/**`.
- Email Templates: "Magic Link" (subject "Нэвтрэх код") and "Invite user" (subject "Редакцын
  багт урилга") from `supabase/templates/`. The sign-in email must contain `{{ .Token }}`.
- SMTP Settings: a custom SMTP server (e.g. Resend's). The built-in one is for testing only and
  sends a few emails an hour.

**4. First admin.** Authentication → Users → Add user → invite your address, then in the SQL
editor:

```sql
insert into public.staff (user_id, name, role)
select id, 'Your name', 'admin' from auth.users where email = 'you@example.mn';
```

Sign in at `https://<domain>/admin` and invite the rest of the team from **Тохиргоо → Редакцын
баг**.

**5. Settings** (**Тохиргоо → Нийтлэх дүрэм ба холбоос**, as admin): site URL
`https://<domain>` (links in emails), functions URL `https://<ref>.supabase.co/functions/v1`
(the database calls `send-emails` and `watch-documents` there), and the static host's deploy hook
(publishing a story rebuilds the prerendered pages).

**6. Static host.** Build command `npm run build`, output `dist/`. Environment:
`VITE_SUPABASE_URL=https://<ref>.supabase.co`, `VITE_SUPABASE_ANON_KEY=<publishable key>`,
`SITE_URL=https://<domain>`. The prerender reads the published stories from the API, so the
build needs network access.

- **Vercel:** `vercel.json` (clean URLs, rewrites to the app, security headers).
- **Netlify:** `public/_redirects` and `public/_headers` (keep the headers in step with
  `vercel.json`).

The site talks only to the Supabase API: fonts are bundled, no analytics, no CDNs.

## Before launch

- [ ] In the admin, fill every `TODO_VERIFY` and resolve every reviewer note in the stories
      (the **Шалгалт** panel lists both), then publish them (two people).
- [ ] Re-check the budget bills' current stage on d.parliament.mn and update the stage and
      timeline of the budget story.
- [ ] Check the tax brackets in the law and mark the tax rules as verified (**Тохиргоо**).
- [ ] Replace the E-Mongolia and petition links with the exact pages (**Тохиргоо → Албан ёсны
      сувгууд**).

## Change the name

`APP_NAME` in `src/config.ts` is the only place the name is written. The page title, header,
About page and favicon all follow it.
