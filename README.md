# Тод — plain-language civic news

A mobile-first news site where every story is built from one official document of the State
Great Khural (УИХ) or the Government — a law, bill, resolution, regulation, budget or investment
project. Each story explains in plain Mongolian what changed, what it means, who it affects, what
it is based on (every sentence links to its source), where the document is in its process, and
how a citizen can respond through an official channel (D-Parliament, legalinfo.mn, E-Mongolia,
public petition). Readers can search, follow documents and share stories; the feed tracks the
next dates and latest steps of every document. Built for the Open Parliament Hackathon 2026.

The site speaks as the finished product. [Showcase notes](#showcase-notes) list what runs today
and what the full system adds.

> **Тод бол бие даасан иргэний мэдээллийн платформ. УИХ, Засгийн газрын албан ёсны сайт биш.**
> Tod is an independent civic information platform, not an official site of the State Great
> Khural or the Government.

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
  `TODO_VERIFY`. The site renders it as a dashed "Баталгаажуулж байна" box, never as raw text.
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

## Showcase notes

The site is written as the product will run once it is funded, but nothing on it is made up:
every number, date and event comes from the story files, and there are no invented readers,
counts or reviews (CLAUDE.md rule 13).

| On the site                                         | What runs today                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Stories, sources, calculator                        | Written by the team from official documents (AI draft + human check) in `src/data/stories/*.json`. No backend.                     |
| Арга зүй pipeline (Автомат / AI / Редактор / Иргэн) | The method. Automatic collection, change detection and notifications are what the funding builds; today the team runs those steps. |
| Шийдвэрүүд хаана явж байна? (feed)                  | Computed from the story timelines: dated upcoming steps with day counts, next steps without a date, each document's latest step.   |
| Search                                              | In the browser, over titles, summaries, changes, meaning, affected groups and timeline steps. `?q=` in the URL.                    |
| Дагах / Дагаж буй                                   | Kept in the reader's browser (localStorage key `tod:following`). No account and no notifications yet.                              |
| Хуваалцах                                           | The phone's share sheet (Web Share API), or copies the link.                                                                       |
| Баталгаажуулж байна                                 | Any `TODO_VERIFY` value left in a story. Run `npm run check:strict` before showing the site.                                       |

## Before the demo

- [ ] Fill every `TODO_VERIFY` in non-draft stories and resolve every `verify` note (`npm run check` lists both).
- [ ] Re-check the budget bills' current stage on d.parliament.mn and update `stage` and `timeline` in `budget-2027.json`.
- [ ] Check the tax brackets in the law, set `taxRules.verified` to `true`, update `tests/tax.test.ts`.
- [ ] Replace the E-Mongolia and petition links with the exact pages.
- [ ] Create the УИХ-ын тогтоол story from `_template.json`.
- [ ] Optionally set `DEMO_TODAY` for stable countdowns.
- [ ] Decide how "Дагаж буй" starts: open the site in a private window for an empty list, or follow
      the two featured stories beforehand so the feed opens with it.
- [ ] Run `npm run check:strict && npm run build && npm run preview` with Wi-Fi off.
- [ ] Record a 60-second screen capture as a backup.
