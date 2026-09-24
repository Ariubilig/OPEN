# Тод — plain-language civic news (Open Parliament Hackathon 2026 demo)

A mobile-first prototype of a news site where every story is built from one official document of
the State Great Khural (УИХ) or the Government — a law, bill, resolution, regulation, budget or
investment project. Each story explains in plain Mongolian what changed, what it means, who it
affects, what it is based on (every sentence links to its source), where the document is in its
process, and how a citizen can respond through an official channel (D-Parliament, legalinfo.mn,
E-Mongolia, public petition). There is no backend and no live AI: the "AI draft + human review"
output is pre-written in `src/data/stories/*.json`, and the About page (`/about`) says honestly
which steps of the full system the demo does by hand.

> **Энэ бол хакатоны прототип. УИХ-ын албан ёсны сайт биш.**
> This is a hackathon prototype, not an official site of the State Great Khural.

Project rules for anyone (or any AI) editing the code: [CLAUDE.md](CLAUDE.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # data check + typecheck + production build into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

Other scripts: `npm run typecheck`, `npm run test`, `npm run check`, `npm run check:strict`,
`npm run format`.

## Add a story

1. Copy `src/data/stories/_template.json` to a new file, e.g. `src/data/stories/my-story.json`
   (files starting with `_` are never loaded).
2. Fill it from official sources only: `id` (lowercase slug), type, stage, title, official title,
   summary, timeline, meaning, affects, evidence, participate and `sources`. Every sentence is
   `{ "text": "…", "source": "<id from sources>" }`.
3. Set `"draft": false` (or remove the line) so the site shows it.
4. Run `npm run check` and fix what it reports.

One story per file. Keep the JSON readable and don't reformat files you are not changing
(Prettier ignores `src/data/`).

## Verify data

- **`TODO_VERIFY`** — any value nobody has confirmed yet. Never guess: write the literal string
  `TODO_VERIFY`. The site renders it as a dashed "Баталгаажуулах" box, never as raw text.
  It can also sit inside a string, e.g. `"…зүйл, заалт: TODO_VERIFY"`.
- **`verify`** — a note to the reviewer (on a sentence, a timeline item, a key number, or a
  story-level list). It is never shown on the site.
- **`npm run check`** validates every file (schema, source ids, timeline rules, featured-story
  completeness, links, a neutrality word check) and lists every `TODO_VERIFY` and every `verify`
  note with its file and JSON path. It fails only on real errors.
- **`npm run check:strict`** additionally fails while any `TODO_VERIFY` is left in a published
  story or `taxRules.verified` is `false`. Use it before the demo.
- **`npm run build`** runs `npm run check` first (`prebuild`): a story file that breaks the schema
  fails the build (and a Vercel/Netlify deploy) instead of shipping a blank page.

## Change the name

`APP_NAME` in `src/config.ts` is the only place the name is written. The page title, header,
About page and favicon all follow it.

## Deploy

Any static host. The build output is `dist/`.

- **Vercel:** `vercel.json` rewrites every path to `/index.html`.
- **Netlify:** `public/_redirects` (`/*  /index.html  200`) is copied into `dist/`.

Fonts are bundled; the site makes no requests to third-party servers after it loads.

## Before the demo

- [ ] Fill every `TODO_VERIFY` in non-draft stories and resolve every `verify` note (`npm run check` lists both).
- [ ] Re-check the budget bills' current stage on d.parliament.mn and update `stage` and `timeline` in `budget-2027.json`.
- [ ] Check the tax brackets in the law, set `taxRules.verified` to `true`, update `tests/tax.test.ts`.
- [ ] Replace the E-Mongolia and petition links with the exact pages.
- [ ] Create the УИХ-ын тогтоол story from `_template.json`.
- [ ] Optionally set `DEMO_TODAY` for stable countdowns.
- [ ] Run `npm run check:strict && npm run build && npm run preview` with Wi-Fi off.
- [ ] Record a 60-second screen capture as a backup.
