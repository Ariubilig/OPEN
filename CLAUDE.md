# CLAUDE.md — project rules

1. All UI text is Mongolian Cyrillic; code, identifiers and file names are English. UI labels live in `src/copy.ts`; components never hard-code Mongolian text except content coming from data.
2. No sentence without a source. Every content sentence is a `Cited` object `{ text, source }` and renders with a tappable source marker. `npm run check` fails on missing or unknown source ids.
3. Never invent legal text, numbers, dates, names or URLs. Unknown values are the literal string `TODO_VERIFY`, rendered as a visible dashed placeholder "Баталгаажуулж байна" — never as raw text.
4. Neutral language: no evaluative words and no party framing. Where actors disagree, show each position as a cited fact with identical styling.
5. Use official names exactly: document types and stages come from `src/data/schema.ts` (a law is "Хууль", a bill is "Хуулийн төсөл", a regulation is "Журам").
6. Every story shows "Энэ нь мэдээлэл бөгөөд хуулийн зөвлөгөө биш." Every page footer shows "Тод бол бие даасан иргэний мэдээллийн платформ. УИХ, Засгийн газрын албан ёсны сайт биш." (`copy.footer.independent`, built from `APP_NAME`). Never use the State emblem, the Soyombo, the flag or any government logo.
7. Do not copy wording from news sites into story text; news articles are citations for facts and dates only.
8. Offline after build: no runtime requests to third-party servers (fonts bundled via @fontsource, no CDNs, no analytics). Outbound links use target="_blank" rel="noopener noreferrer".
9. Accessibility: `<html lang="mn">`, semantic landmarks, visible focus, tap targets ≥ 44px, WCAG AA contrast, prefers-reduced-motion respected.
10. Formats: dates `2026.06.26` (`formatDate`), exact amounts `12,080₮` (`formatMNT`), large sums in words, e.g. `43.6 их наяд төгрөг`.
11. Code style: TypeScript strict. Prettier: `{ "semi": false, "singleQuote": true, "tabWidth": 2, "trailingComma": "all" }`.
12. Story JSON is edited by a teammate in parallel: one story per file, readable formatting, never reformat data files you are not changing.
13. Product voice: the site speaks as the running product. No "демо", "прототип", "хакатон" or "гараар" wording in UI text (`tests/copy.test.ts` checks `copy.ts`). Nothing may be invented to look busy either: no made-up readers, users, reviews, counts or activity. Anything that looks live (tracker, recent events, countdowns, follow list) is computed from the story data or kept in the reader's own browser.
