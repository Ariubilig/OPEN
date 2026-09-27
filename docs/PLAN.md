# Тод — from hackathon prototype to a working product

This is the working plan for turning the Open Parliament Hackathon 2026 prototype into a real,
running news site backed by Supabase. Each phase ends with its checks passing and one commit on
the `claude/supabase` branch. Tick the boxes as phases land.

- [x] Phase 0: plan, decisions, local Supabase project
- [x] Phase 1: database core (schema, row-level security, workflow functions, validation, DB tests)
- [x] Phase 2: seed data and tooling (seed from the existing JSON, generated types, shared validator)
- [x] Phase 3: public site reads from Supabase
- [x] Phase 4: admin shell and staff sign-in
- [x] Phase 5: story editor
- [x] Phase 6: review and publishing workflow
- [x] Phase 7: reader error reports and search
- [x] Phase 8: SEO and sharing (per-story link previews, sitemap, RSS)
- [ ] Phase 9: email alerts when a story's stage changes
- [ ] Phase 10: AI draft with Claude
- [ ] Phase 11: document watcher
- [ ] Phase 12: deploy to the Supabase project "Hackathon"

---

## 1. Where we start

- Vite + React 19 + React Router 7 single-page app, Tailwind v4, zod. Mobile-first, polished UI.
- Six stories as JSON files in `src/data/stories/`, plus `channels.json` and `taxRules.json`,
  bundled into the app at build time. `src/data/schema.ts` (zod) is the story contract.
- `npm run check` validates the JSON (schema, source ids, timeline rules, featured completeness,
  links, a neutrality word list) and lists every `TODO_VERIFY` and reviewer note.
- No backend. The About page says which steps of the pipeline the demo did by hand: collecting,
  detecting changes, AI draft (pre-written), human review, notifications (not built).

## 2. Goals and non-goals

Goals:

1. Stories live in Supabase Postgres. The public site reads published stories from it.
2. Staff write and edit stories in an admin area: structured forms, live validation, a preview that
   is the real story page, revision history.
3. Two people check every story before it goes live (the principle "Тоо, огноо бүрийг эх
   бичвэртэй хоёр хүн тулгаж шалгана"). Publishing is gated by the same rules `npm run check`
   enforces today, now also inside the database.
4. Readers can report an error on a story, search, and follow a story to get an email when its
   stage changes.
5. AI draft with Claude from an official document. A human edits and a second human publishes.
6. A document watcher checks official pages every day and flags changes to editors.
7. Runs on the existing Supabase project "Hackathon" (`kgjdvzuprtvlxfitljln`, Singapore) and any
   static host for the web app.

Not in scope now: server-side rendering, reader accounts, comments, site-specific scrapers for
d.parliament.mn, image uploads, an English interface, native apps.

## 3. Architecture

```
 Reader's browser (public SPA)                 Staff browser (/admin, lazy-loaded chunk)
   @supabase/postgrest-js, anon key              @supabase/supabase-js, signed-in user
        │  read: published_stories,                    │  email one-time code sign-in
        │        story_cards, get_channels(),          │  RPC: create/save/submit/publish…
        │        get_tax_rules(), search_stories()     │  edge functions: ai-draft, invite-staff,
        │  write (RPC): submit_report, subscribe,      │                  watch-documents (run now)
        │        confirm_subscription, unsubscribe     │
        ▼                                              ▼
 ┌──────────────────────────── Supabase ─────────────────────────────────────────────┐
 │ Postgres: stories (working copies) → story_revisions (every change)               │
 │           published_stories (public snapshot, JSON-schema checked)                │
 │           channels, tax_rules, settings, staff, reports, subscribers,             │
 │           subscriptions, email_outbox, watched_documents, watch_events            │
 │ Extensions: pg_jsonschema (gate), pg_trgm (search), pg_net (HTTP), pg_cron (jobs) │
 │ Edge functions (Deno): ai-draft (Claude), send-emails (Resend),                   │
 │                        watch-documents, invite-staff                              │
 └───────────────────────────────────────────────────────────────────────────────────┘
 Build: vite build → scripts/prerender.ts writes per-story HTML meta, sitemap.xml, rss.xml
```

### Key decisions

| #   | Decision                                                                                                                                                                                                         | Why                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Keep the Vite SPA. Move to React Router's data router (route loaders). Prerender per-story `<head>` tags at build time; rebuild on publish via a deploy hook.                                                    | The UI is done and good. Static hosting stays simple and fast. Link previews on Facebook and chat apps need per-story tags, which prerendering gives without running a server.            |
| D2  | A story is one JSONB document validated by the existing zod schema, with generated columns (type, stage, topics, groups, featured, order, search) for queries.                                                   | A story is a nested document that is always edited and published as a whole. The contract already exists. Splitting it into ~15 tables adds ordering and join work with no query benefit. |
| D3  | Working copy (`stories`) and public snapshot (`published_stories`) are separate tables. Anonymous users can only read the snapshot.                                                                              | Editing a live story never changes the live page until it is published again. Drafts and reviewer notes never leak.                                                                       |
| D4  | Every editorial write goes through a `security definer` function that checks the role, bumps a version number (optimistic locking) and writes a revision row. No client writes to editorial tables directly.     | One place for the rules; a full audit trail; two editors saving at once get a clear conflict instead of a silent overwrite.                                                               |
| D5  | Validate twice: in TypeScript (`src/lib/validate.ts`, shared by `npm run check` and the editor) for per-field messages, and in SQL (`story_problems()` + JSON Schema generated from zod) as the gate at publish. | Friendly messages where people type; a hard guarantee where it matters. A test fails if the SQL JSON Schema drifts from zod.                                                              |
| D6  | The public bundle uses `@supabase/postgrest-js` (~8 kB gz); the admin chunk uses `@supabase/supabase-js`.                                                                                                        | Readers on phones do not download auth code they never use.                                                                                                                               |
| D7  | Staff sign in with a 6-digit email code. Sign-up is off; an admin invites staff. Roles: editor, reviewer, admin.                                                                                                 | No passwords to leak; nobody can create an account on their own.                                                                                                                          |
| D8  | Secrets live in Supabase secrets (edge functions) and the host's env. The service-role key never reaches a browser. Integrations without a key stay off and say so.                                              | Safe defaults; the site works before every integration is configured.                                                                                                                     |

## 4. Data model

All tables in `public` have row-level security on. Helper functions live in a `private` schema
that the API does not expose.

### Enums

- `staff_role`: `editor`, `reviewer`, `admin`
- `story_state`: `draft`, `in_review`, `changes_requested`, `published` (published = the working
  copy equals the live snapshot)
- `revision_action`: `create`, `import`, `ai_draft`, `save`, `restore`, `submit`,
  `request_changes`, `publish`, `unpublish`

### Tables

| Table                   | Columns (main)                                                                                                                                                                                                                              | Read                                                | Write                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `staff`                 | `user_id` → auth.users, `name`, `role`                                                                                                                                                                                                      | staff                                               | admin (RPC / invite function)                           |
| `settings` (one row)    | `require_two_person_review`, `site_url`, `functions_url`, `deploy_hook_url`                                                                                                                                                                 | staff                                               | admin                                                   |
| `stories`               | `id` (slug, pk), `content` jsonb, `state`, `review_note`, `version`, `created_by/at`, `updated_by/at`, `submitted_by/at`                                                                                                                    | staff                                               | RPC only                                                |
| `story_revisions`       | `id`, `story_id`, `content`, `action`, `note`, `author`, `created_at`                                                                                                                                                                       | staff                                               | RPC only                                                |
| `published_stories`     | `id`, `content` (JSON-schema checked, reviewer notes stripped), `revision_id`, `first_published_at`, `published_at`, `published_by`; generated: `type`, `stage`, `featured`, `sort_order`, `published_on`, `topics[]`, `groups[]`, `search` | everyone                                            | RPC only                                                |
| `story_cards` (view)    | the fields feed cards need: id, type, stage, topics, groups, featured, order, title, summary, publishedAt, timeline, source count                                                                                                           | everyone                                            | —                                                       |
| `channels`              | `id`, `sort_order`, `content` (JSON-schema checked)                                                                                                                                                                                         | staff; public via `get_channels()` (notes stripped) | admin                                                   |
| `tax_rules`             | `id` = `pit`, `content` (JSON-schema checked)                                                                                                                                                                                               | staff; public via `get_tax_rules()`                 | admin                                                   |
| `reports`               | `story_id`, `message`, `contact`, `status`, `created_at`, `resolved_by/at`                                                                                                                                                                  | staff                                               | anyone via `submit_report()` (throttled); staff resolve |
| `subscribers`           | `email`, `token`, `confirmed_at`                                                                                                                                                                                                            | admin                                               | via RPCs only                                           |
| `subscriptions`         | `subscriber_id`, `story_id`                                                                                                                                                                                                                 | admin                                               | via RPCs only                                           |
| `email_outbox`          | `to_email`, `template`, `data`, `status`, `attempts`, `last_error`, `sent_at`                                                                                                                                                               | admin                                               | triggers + `send-emails`                                |
| `watched_documents`     | `url`, `label`, `story_id`, `last_hash`, `last_text`, `last_checked_at`, `last_changed_at`, `last_status`, `last_error`, `active`                                                                                                           | staff                                               | staff                                                   |
| `watch_events`          | `document_id`, `old_text`, `new_text`, `detected_at`, `seen_by/at`                                                                                                                                                                          | staff                                               | `watch-documents`; staff mark seen                      |
| `rate_limits` (private) | `key`, `window_start`, `count`                                                                                                                                                                                                              | —                                                   | throttle helper                                         |

### Workflow functions (RPC)

| Function                                                                                    | Who             | What                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_story(id, content, action)`                                                         | staff           | New working copy (`create`, `import` or `ai_draft`); `content.id` forced to `id`; `draft` key dropped.                                                                                                                                                                                                                                                                                 |
| `save_story(id, content, version)`                                                          | staff           | Optimistic lock (HTTP 409 on a stale version). `published` → `draft`; a story sent back stays `changes_requested` until it is resubmitted. Records `updated_by`.                                                                                                                                                                                                                       |
| `submit_story(id, version, note)`                                                           | staff           | `draft`/`changes_requested` → `in_review`.                                                                                                                                                                                                                                                                                                                                             |
| `request_changes(id, version, note)`                                                        | reviewer, admin | `in_review` → `changes_requested` with a required note.                                                                                                                                                                                                                                                                                                                                |
| `publish_story(id, version, note, correction)`                                              | reviewer, admin | Two-person rule: the publisher is not the last person who changed the content (setting, on by default). Sets `publishedAt` on first publish, `updatedAt` on later ones, `reviewed = {by: reviewer's name, date: today in Ulaanbaatar}`, appends a dated correction when given. Runs `story_problems()`; any problem → HTTP 422 with codes. Writes the snapshot without reviewer notes. |
| `unpublish_story(id, note)`                                                                 | reviewer, admin | Removes the snapshot; working copy → `draft`.                                                                                                                                                                                                                                                                                                                                          |
| `restore_revision(revision_id, version)`                                                    | staff           | Copies an old revision into the working copy (as a save).                                                                                                                                                                                                                                                                                                                              |
| `delete_story(id)`                                                                          | admin           | Only when not published.                                                                                                                                                                                                                                                                                                                                                               |
| `get_channels()`, `get_tax_rules()`                                                         | everyone        | Public reference data, reviewer notes stripped.                                                                                                                                                                                                                                                                                                                                        |
| `search_stories(q)`                                                                         | everyone        | Prefix full-text search over title, summary, official title.                                                                                                                                                                                                                                                                                                                           |
| `submit_report(story_id, message, contact)`                                                 | everyone        | Length limits, throttled per IP.                                                                                                                                                                                                                                                                                                                                                       |
| `subscribe(email, story_id)`, `confirm_subscription(token)`, `unsubscribe(token, story_id)` | everyone        | Double opt-in, throttled; unsubscribing from the last story deletes the email.                                                                                                                                                                                                                                                                                                         |

`story_problems(content)` returns codes with JSON paths, e.g. `unknown_source $.meaning[2].source`:
`schema`, `id_mismatch`, `duplicate_source`, `unknown_source`, `timeline_source_required`,
`timeline_current_count`, `timeline_order`, `featured_meaning`, `featured_affects`,
`featured_evidence`, `featured_participate`, `featured_numbers`, `unknown_related` (no such story
at all; the site hides links to unpublished ones, so two stories can link to each other),
`self_related`, `unknown_channel`. The admin maps codes to Mongolian messages.

### Triggers

- `published_stories` after insert/update/delete → call the deploy hook (if set) so the static
  host rebuilds link previews; after update where `stage` changed → queue a `stage_change` email
  for each confirmed subscriber.
- `email_outbox` after insert → ask `send-emails` to run (pg_net). A pg_cron job retries every
  10 minutes.
- pg_cron daily 02:00 Ulaanbaatar → `watch-documents`.

## 5. Phases

Every phase: `npm run typecheck`, `npm test`, `npm run check`, `supabase test db` (from phase 1),
browser check of what changed (from phase 3), then a commit.

### Phase 0 — plan and local project ✅

- This document. `supabase init`; `config.toml`: project id `tod`, realtime/storage/analytics off,
  sign-up off (invite-only), site URL `http://localhost:5173`, ports 553xx.
- CLAUDE.md updates (see section 6).

### Phase 1 — database core

Files: `supabase/migrations/*_core.sql`, `*_stories.sql`, `*_story_validation.sql`,
`*_workflow.sql`, `*_reference_data.sql`; `supabase/tests/database/*.test.sql`.

- Extensions, `private` schema, enums, `staff`, `settings`, role helpers.
- `stories`, `story_revisions`, `published_stories` (+ generated columns, indexes), `story_cards`.
- JSON Schema functions generated from zod (`scripts/gen-json-schema.ts`), check constraints on
  `published_stories`, `channels`, `tax_rules`.
- `story_problems()`, `strip_internal()`, workflow RPCs, grants (anon cannot execute staff RPCs).
- `channels`, `tax_rules`, `get_channels()`, `get_tax_rules()`.
- pgTAP tests: anon sees only snapshots; editor cannot publish; two-person rule; version conflict;
  publish strips notes and fills `reviewed`; unknown source blocks publish; request changes;
  unpublish; restore.
- `supabase db advisors` shows no security warnings.

Done when: `supabase db reset` and `supabase test db` pass.

### Phase 2 — seed data and tooling

- Move `src/data/stories/*.json`, `channels.json`, `taxRules.json` to `supabase/seed/` with
  `git mv` (content unchanged).
- `scripts/gen-seed.ts` → `supabase/seed.sql`: three local staff users (admin, editor, reviewer
  at `*@tod.test`), channels, tax rules, every story as a working copy plus a published snapshot
  (drafts stay unpublished). Seed passes the same database checks.
- `src/lib/validate.ts`: the story rules from `scripts/check.ts` as a pure function returning
  findings with codes and paths. `scripts/check.ts` becomes a thin CLI over it, reading
  `supabase/seed/`.
- `npm run db:types` → `src/data/database.types.ts` (generated).
- Tests: validator unit tests, JSON Schema drift test, existing data tests pointed at the seed.

### Phase 3 — public site reads from Supabase

- `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SITE_URL`.
- `src/data/api.ts`: `fetchSite()` (channels + tax rules), `fetchCards()`, `fetchStory(id)`,
  `fetchStoriesForGroup(group)`, `fetchCardsByIds(ids)`. Every row is parsed with zod; an invalid
  story is skipped with a console error instead of breaking the page. Small in-memory cache.
- `createBrowserRouter` with loaders: root (site data), feed (cards; group stories when `?group=`),
  story (story + related cards, or not-found + featured), not-found (featured).
- Loading bar during navigation, first-load skeleton, error screen with "Дахин оролдох".
- Components take data from loaders instead of module imports (`FeedCard` uses `sourceCount`).
- Footer and About page say what is true now (no "hackathon prototype"; the pipeline statuses).

### Phase 4 — admin shell and staff sign-in

- `/admin/*` routes, lazy-loaded; `src/admin/copy.ts` for admin labels.
- Sign-in: email → 6-digit code (Mongolian email templates for the code and for invites).
- Guard: signed-in user without a `staff` row sees "no access".
- Dashboard: story list with state, live or not, last change and who made it, `TODO_VERIFY`
  count; filters by state; "Шинэ мэдээ".
- Settings (admin): staff list, invite (edge function `invite-staff`), change role, remove;
  two-person rule toggle; site URL, functions URL, deploy hook. Channels and tax rules forms.

### Phase 5 — story editor

- Form primitives: text, textarea, select, checkbox, date with "unknown" (`TODO_VERIFY`) and
  "not scheduled" (null), URL with "unknown", source picker, cited sentence (text + source +
  reviewer note), list editor (add, remove, move).
- Sections in the order of the story page: basics, sources, changes, key numbers, meaning and
  positions, affects, timeline, evidence, participate, related stories, team notes.
- Live validation (zod with a Mongolian error map + `validate.ts`): messages under each field and
  a problems panel that jumps to the field.
- Preview tab renders the real story page with the draft.
- Save (Ctrl+S) with conflict message; unsaved changes kept in the browser and offered back.
- New story: from scratch or import a JSON file; export JSON.

### Phase 6 — review and publishing

- Buttons by state and role: submit for review, request changes (note), publish (note + optional
  correction line), unpublish. The two-person rule is explained when it blocks.
- Review queue filter; "changes since the live version" line diff.
- History tab: every revision with who, when, what, note; view; restore.

### Phase 7 — reader error reports and search

- "Алдаа мэдээлэх" on each story opens a small form → `submit_report()`; admin inbox to resolve.
- Search page `/search?q=` from the header; results as feed cards.

### Phase 8 — SEO and sharing

- `scripts/prerender.ts` after `vite build`: per-story `dist/story/<id>/index.html` with title,
  description, Open Graph tags, canonical URL and NewsArticle JSON-LD; `sitemap.xml`, `rss.xml`,
  `robots.txt`. Skips with a warning when the database cannot be reached.
- Deploy-hook trigger. Security headers (CSP allowing only the Supabase URL) in `vercel.json`.

### Phase 9 — email alerts

- "Мэдэгдэл авах" on the story page → `subscribe()`; `/alerts/confirm` and `/alerts/unsubscribe`.
- Outbox, triggers, `send-emails` function (Resend; logs a dry run without `RESEND_API_KEY`).
- Stage-change email: story title, old → new stage, link, unsubscribe link, the disclaimer.

### Phase 10 — AI draft with Claude

- `ai-draft` function: signed-in staff only; input = official document text + its source
  details + story id and type. Claude returns a story in the schema with every sentence cited to
  that source, unknown values as `TODO_VERIFY`, and a reviewer note on every generated sentence.
  Saved as a draft with action `ai_draft`. Without `ANTHROPIC_API_KEY` it answers "not configured".
- Admin page "AI ноорог".

### Phase 11 — document watcher

- `watch-documents` function: fetches each active URL (skips ones checked in the last 6 hours
  unless staff force it), extracts text, hashes it, records a change event with old and new text.
- Daily pg_cron job; admin page to add documents, run now, see changes as a diff, mark seen.

### Phase 12 — deploy

- Inspect the "Hackathon" project first and report what is in it; nothing is changed until that
  is clear.
- `supabase link`, `supabase db push`, `supabase functions deploy`, secrets
  (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`), auth settings (sign-up off, site URL,
  redirect URLs, email templates), settings row (site URL, functions URL), first admin account.
- Web app: env vars on the static host, build, smoke test.

## 6. Project rule changes (CLAUDE.md)

- Rule 1: admin labels live in `src/admin/copy.ts` (lazy chunk), public labels in `src/copy.ts`.
- Rule 6: the footer no longer says "хакатоны прототип" (the hackathon is over). It keeps
  "УИХ-ын албан ёсны сайт биш."
- Rule 8: the only runtime server the browser talks to is this project's Supabase API.
- Rule 12: stories live in the database and are edited in `/admin`; `supabase/seed/*.json` is
  seed data (same formatting rule).
- New rules: migrations are append-only; RLS on every table; editorial writes only through
  RPCs; no service-role key in the browser; generated files are never edited by hand.

## 7. Environments

| Variable                                      | Where                  | Purpose                      |
| --------------------------------------------- | ---------------------- | ---------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env.local`, host env | Public API access            |
| `SITE_URL`                                    | host env (build)       | Canonical URLs, sitemap, RSS |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`        | Supabase secrets       | AI draft                     |
| `RESEND_API_KEY`, `EMAIL_FROM`                | Supabase secrets       | Email alerts                 |

Local: `supabase start` → API `http://127.0.0.1:55321`, database `:55322`, Studio `:55323`, email
inbox (Mailpit) `:55324`. The ports are moved off the defaults (543xx) so this stack runs next to
other local Supabase projects. `npm run dev` → `http://localhost:5173`, admin at `/admin`.

## 8. Risks

- The local Postgres build (supabase/postgres 17.6.1.106) crashes a backend when a superuser
  session does `SET ROLE anon` and then calls a function it may not execute. Through the API
  (PostgREST) the same call returns a clean 42501, so it is not reachable from outside. DB tests
  check function privileges with `has_function_privilege()` instead of calling. Re-check on the
  hosted project before launch.
- Official sites that render with JavaScript look unchanged to the watcher (it reads HTML only).
  The admin shows the last fetched text so an editor can tell.
- Email deliverability needs a verified sending domain in Resend.
- The two-person rule blocks a one-person team; an admin can turn it off in settings, and the
  history records who published.
- The free Supabase tier pauses inactive projects; the site shows the error screen then.
