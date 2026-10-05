# Setting up Supabase from the dashboard

This sets up a new Supabase project for Тод using only the Supabase dashboard (its SQL editor and
settings pages). No Docker and no local database are needed. Step 7 uses the Supabase CLI
through `npx` for the edge functions; you can skip it at first.

The SQL files you will paste:

| Step | File                             | What it does                                                  |
| ---- | -------------------------------- | ------------------------------------------------------------- |
| 2    | `supabase/setup/schema.sql`      | Every table, function and rule (all of `supabase/migrations`) |
| 3    | `supabase/bootstrap.sql`         | Official channels, tax rules, the stories as drafts           |
| 5    | `supabase/setup/first-admin.sql` | Makes you the first admin                                     |

Open a file in the repository, select everything, copy, and paste it into a new query in the SQL
editor (**SQL Editor → New query**), then press **Run**. Paste the whole file, not part of it.

## 1. Create the project

1. In <https://supabase.com/dashboard>, **New project**.
2. Pick a region close to your readers (for Mongolia: Seoul or Tokyo).
3. Save the database password somewhere safe. You need it only for the CLI later.

Wait until the project shows as ready.

## 2. Create the database: `supabase/setup/schema.sql`

Paste `supabase/setup/schema.sql` into a new query and run it.

- The editor may warn that the query has destructive operations. Confirm: the words it reacts to
  (`delete`, `truncate`) are inside function bodies and permission statements. On a new project
  nothing is deleted.
- The editor runs the file as one transaction. If it stops with an error, nothing is kept; fix the
  cause (see **Troubleshooting**) and run the whole file again.
- Expected result: "Success. No rows returned".

Check it worked (new query):

```sql
select count(*) as tables from information_schema.tables where table_schema = 'open';
select jobname, schedule from cron.job;
```

You should see a dozen or more tables and two jobs, `send-emails` and `watch-documents`.

Then let the API serve the app's schema: **Project Settings → Data API → Exposed schemas**, add
`open` and save. Without it the site and the admin get "Invalid schema: open".

## 3. Load the starting data: `supabase/bootstrap.sql`

Paste `supabase/bootstrap.sql` into a new query and run it. It adds the official channels, the tax
rules for the calculator, and the six stories as drafts. Nothing is published yet, and running
it again adds nothing.

```sql
select count(*) as channels from open.channels;   -- 5
select id, state from open.stories order by id;   -- 6 rows, all "draft"
```

## 4. Sign-in settings (Authentication)

Staff sign in with a 6-digit code sent by email. Readers never sign in.

1. **Sign In / Providers → Email**: keep Email enabled. Turn **off** "Allow new users to sign
   up" (people join only by invitation). Set **Email OTP length** to `6` (the sign-in form takes
   six digits) and **Email OTP expiration** to `900` seconds (the email says 15 minutes).
2. **URL Configuration**:
   - Site URL: `http://localhost:5173` for now; change it to your real address in step 6.
   - Redirect URLs: add `http://localhost:5173/admin/**` (and later
     `https://<your-domain>/admin/**`).
3. **Email Templates**:
   - **Magic Link**: subject `Нэвтрэх код`; body: the contents of
     `supabase/templates/magic_link.html`. It must contain `{{ .Token }}`, which is the code.
   - **Invite user**: subject `Редакцын багт урилга`; body: `supabase/templates/invite.html`.
4. **SMTP Settings**: the built-in mail service sends only a few emails an hour and is meant for
   testing. That is enough to sign yourself in. Before inviting the team, set up a custom SMTP
   server (for example Resend's SMTP).

## 5. Make yourself the first admin: `supabase/setup/first-admin.sql`

1. **Authentication → Users → Add user → Send invitation** with your email. (Accepting the
   invitation is optional: you sign in with a code anyway.)
2. Open `supabase/setup/first-admin.sql`, replace `you@example.mn` and `Your name` at the top,
   paste it into a new query and run it. The result shows one row with role `admin`.

The file refuses to run while the placeholders are still there, and says so if the address is not
under Authentication → Users yet.

## 6. Connect the site

Find two values under **Project Settings**:

- Project URL: `https://<project-ref>.supabase.co` (the ref is under **General**).
- Publishable key (`sb_publishable_…`), under **API Keys**. Never use a secret or service-role key
  in the site: everything in a `VITE_` variable ends up in the browser.

**Run the site on your computer (optional but quickest check):**

```bash
npm install
cp .env.example .env.local
# in .env.local: VITE_SUPABASE_URL=https://<project-ref>.supabase.co
#                VITE_SUPABASE_ANON_KEY=sb_publishable_...
npm run dev
```

Open <http://localhost:5173/admin>, sign in with your email and the code from the email. You
should see the six draft stories.

**Deploy the site (Vercel):**

1. Import the GitHub repository in Vercel. Build command `npm run build`, output directory
   `dist` (the settings in `vercel.json` do the rest).
2. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (as above) and
   `SITE_URL=https://<your-domain>` (no trailing slash).
3. After the first deploy, back in Supabase **Authentication → URL Configuration**: Site URL
   `https://<your-domain>`, and add `https://<your-domain>/admin/**` to the redirect URLs.
4. In Vercel, **Settings → Git → Deploy Hooks**, create a hook and copy its URL.
5. In the site's admin, **Тохиргоо → Нийтлэх дүрэм ба холбоос** (as admin): site address
   `https://<your-domain>`, and the deploy hook. Publishing a story then rebuilds the link
   previews, sitemap and RSS.

## 7. Edge functions (email alerts, AI draft, document watcher, inviting staff)

The site, the admin and publishing work without these. Each function adds one feature:

| Function          | Feature                                            | Secrets it needs               |
| ----------------- | -------------------------------------------------- | ------------------------------ |
| `invite-staff`    | Inviting the team from **Тохиргоо**                | none                           |
| `send-emails`     | Readers' "notify me when the stage changes"        | `RESEND_API_KEY`, `EMAIL_FROM` |
| `watch-documents` | Daily check of official pages (**Ажиглалт**)       | none                           |
| `ai-draft`        | AI draft from an official document (**AI ноорог**) | `ANTHROPIC_API_KEY`            |

From the repository folder (the CLI runs through `npx`; `--use-api` builds the functions on
Supabase, so no Docker is needed):

```bash
npx supabase login
npx supabase functions deploy --project-ref <project-ref> --use-api
npx supabase secrets set --project-ref <project-ref> \
  ANTHROPIC_API_KEY=... RESEND_API_KEY=... "EMAIL_FROM=Тод <alerts@<your-domain>>"
```

`supabase/functions/.env.example` describes each secret. The Resend sender domain must be verified
in Resend. Then, in the admin's **Тохиргоо → Нийтлэх дүрэм ба холбоос**, set the functions address
to `https://<project-ref>.supabase.co/functions/v1`: the database calls `send-emails` and
`watch-documents` there.

## 8. Publish

Every story is a draft with values marked `TODO_VERIFY` and notes for the reviewer. In the admin,
open a story, check it against its sources (the **Шалгалт** panel lists what is open), and
publish. The two-person rule means the person who last changed a story cannot publish it: invite
a reviewer (step 7, `invite-staff`) or, while you work alone, turn the rule off under
**Тохиргоо → Нийтлэх дүрэм ба холбоос** and back on when the team is there. The README's "Before
launch" list says what to verify first.

## Later: moving to the Supabase CLI

If you start managing the database with the CLI (`supabase link`, `supabase db push`), first mark
the migrations you ran here as applied, so `db push` only runs newer ones. The exact command, with
every version, is at the top of `supabase/setup/schema.sql`:

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration repair --linked --status applied 20260927000100 20260927000200 …
```

For a new migration without the CLI, paste just that file from `supabase/migrations/` into the SQL
editor.

## Troubleshooting

| Message                                                                                  | What to do                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `extension "pg_cron"` (or `pg_net`, `pg_jsonschema`) … not available / permission denied | **Database → Extensions**: enable it there, then run `schema.sql` again.                                |
| `relation … already exists` when running `schema.sql`                                    | The schema is already there (it was run before). Do not run it again; continue with step 3.             |
| `Replace admin_email and admin_name…`                                                    | Edit the two values at the top of `first-admin.sql`.                                                    |
| `No account with the email …`                                                            | Add the address under **Authentication → Users** first, with the same spelling.                         |
| The sign-in email has a link but no code                                                 | The Magic Link template is missing `{{ .Token }}` (step 4).                                             |
| The code is not accepted                                                                 | Check **Email OTP length** is 6; use the newest email; codes expire after 15 minutes.                   |
| Signed in, but "Эрх хүрэхгүй байна"                                                      | The account is not in `open.staff`: run `first-admin.sql` (step 5) with that address.                 |
| The site shows "Сайтын өгөгдлийн сангийн тохиргоо дутуу байна"                           | `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing; on Vercel, redeploy after setting them.     |
| A feature that uses an edge function fails                                               | **Edge Functions → (function) → Logs** shows why; most often a missing secret or the functions address. |
