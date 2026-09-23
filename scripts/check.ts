// Data checks for the seed files (brief §12). Run: npm run check  |  npm run check:strict
//
//  - zod validation of every story (except _*.json), channels.json and taxRules.json
//  - semantic rules for non-draft stories (sources, timeline, featured completeness, links)
//  - neutrality lint (warning)
//  - lists every TODO_VERIFY and every `verify` note, grouped by file
//  - --strict: any TODO_VERIFY in a non-draft story, or unverified tax rules, fails
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { z } from 'zod'
import {
  ChannelsSchema,
  EVIDENCE_STEPS,
  isIsoDate,
  jsonPath,
  StorySchema,
  TaxRulesSchema,
  TODO,
  type Channel,
  type Story,
} from '../src/data/schema'
import { sourceRefs } from '../src/lib/sources'

const strict = process.argv.includes('--strict')
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const STORIES_DIR = 'src/data/stories'
const CHANNELS_FILE = 'src/data/channels.json'
const TAX_FILE = 'src/data/taxRules.json'

// Evaluative word stems (warning only). Matched at the start of a word; Mongolian adds suffixes.
const EVALUATIVE_STEMS = [
  'гайхалтай',
  'гайхамшиг',
  'аймшигтай',
  'амжилттай',
  'амжилтгүй',
  'бүтэлгүй',
  'шилдэг',
  'дэмий',
  'хулгай',
  'луйвар',
  'түүхэн',
]
const EVALUATIVE = new RegExp(
  `(?<!\\p{L})(?:${EVALUATIVE_STEMS.join('|')})\\p{L}*`,
  'giu',
)

// ---- output helpers --------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code: number) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s
const red = paint(31)
const yellow = paint(33)
const green = paint(32)
const dim = paint(2)
const bold = paint(1)

type Finding = { file: string; path?: string; message: string }
const errors: Finding[] = []
const warnings: Finding[] = []
const todos: Finding[] = []
const notes: Finding[] = []
let strictTodoCount = 0

const error = (file: string, path: string | undefined, message: string) =>
  errors.push({ file, path, message })
const warn = (file: string, path: string | undefined, message: string) =>
  warnings.push({ file, path, message })

function printGroup(
  title: string,
  items: Finding[],
  color: (s: string) => string,
) {
  console.log(`\n${bold(color(`${title} (${items.length})`))}`)
  const byFile = new Map<string, Finding[]>()
  for (const f of items) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f])
  for (const [file, list] of byFile) {
    console.log(`  ${file}`)
    for (const f of list) {
      console.log(`    ${f.path ? `${dim(f.path)}  ` : ''}${f.message}`)
    }
  }
}

const shorten = (s: string, max = 90) =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s

// ---- reading + validation --------------------------------------------------

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8'))
  } catch (e) {
    error(file, undefined, `cannot read JSON: ${(e as Error).message}`)
    return undefined
  }
}

function validate<S extends z.ZodType>(
  file: string,
  schema: S,
  raw: unknown,
): z.output<S> | undefined {
  if (raw === undefined) return undefined
  const result = schema.safeParse(raw)
  if (result.success) return result.data
  for (const issue of result.error.issues) {
    error(file, jsonPath(issue.path), issue.message)
  }
  return undefined
}

/** Visit every string in a JSON value with its path. */
function walkStrings(
  value: unknown,
  path: (string | number)[],
  visit: (path: (string | number)[], s: string) => void,
) {
  if (typeof value === 'string') visit(path, value)
  else if (Array.isArray(value))
    value.forEach((v, i) => walkStrings(v, [...path, i], visit))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value))
      walkStrings(v, [...path, k], visit)
}

/** Record TODO_VERIFY occurrences and `verify` notes of one file. Returns the TODO count. */
function collectTodosAndNotes(file: string, raw: unknown): number {
  let count = 0
  walkStrings(raw, [], (path, s) => {
    if (path.includes('verify')) {
      notes.push({ file, path: jsonPath(path), message: s })
      return
    }
    if (!s.includes(TODO)) return
    count++
    todos.push({
      file,
      path: jsonPath(path),
      message: s === TODO ? '' : dim(`"${shorten(s)}"`),
    })
  })
  return count
}

// ---- channels + tax rules --------------------------------------------------

const channelsRaw = readJson(CHANNELS_FILE)
const channels: Channel[] =
  validate(CHANNELS_FILE, ChannelsSchema, channelsRaw) ?? []
collectTodosAndNotes(CHANNELS_FILE, channelsRaw)
channels.forEach((c, i) => {
  if (c.url === null)
    warn(
      CHANNELS_FILE,
      `$[${i}].url`,
      `"${c.id}" has no link yet (card shows no button)`,
    )
  if (c.verify)
    warn(CHANNELS_FILE, `$[${i}].verify`, `"${c.id}" has an open verify note`)
})
const channelIds = new Set(channels.map((c) => c.id))
if (channelsRaw !== undefined) {
  const ids = channels.map((c) => c.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dup.length)
    error(CHANNELS_FILE, undefined, `duplicate channel ids: ${dup.join(', ')}`)
}

const taxRaw = readJson(TAX_FILE)
const taxRules = validate(TAX_FILE, TaxRulesSchema, taxRaw)
collectTodosAndNotes(TAX_FILE, taxRaw)
if (taxRules) {
  const todoRates = taxRules.years.flatMap((y, yi) =>
    y.brackets
      .map((b, bi) => ({
        b,
        path: `$.years[${yi}].brackets[${bi}].rate`,
        year: y.year,
      }))
      .filter((x) => x.b.rate === TODO),
  )
  if (taxRules.verified && todoRates.length) {
    error(
      TAX_FILE,
      '$.verified',
      `is true but ${todoRates.length} rate(s) are still ${TODO}`,
    )
  }
  if (!taxRules.verified) {
    warn(
      TAX_FILE,
      '$.verified',
      'tax rules are not verified (calculator shows a banner)',
    )
  }
  for (const t of todoRates)
    warn(TAX_FILE, t.path, `${t.year}: rate is ${TODO}`)
  taxRules.years.forEach((y, yi) => {
    let prev = 0
    y.brackets.forEach((b, bi) => {
      if (b.upTo !== null && b.upTo <= prev)
        error(
          TAX_FILE,
          `$.years[${yi}].brackets[${bi}].upTo`,
          'brackets must increase',
        )
      if (b.upTo !== null) prev = b.upTo
    })
  })
}

// ---- stories ---------------------------------------------------------------

type Loaded = { file: string; raw: unknown; story?: Story; draft: boolean }

const storyFiles = readdirSync(join(ROOT, STORIES_DIR))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort()

const loaded: Loaded[] = storyFiles.map((name) => {
  const file = `${STORIES_DIR}/${name}`
  const raw = readJson(file)
  const draft =
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { draft?: unknown }).draft === true
  return { file, raw, draft, story: validate(file, StorySchema, raw) }
})

// Story ids are unique across files
const idFiles = new Map<string, string[]>()
for (const l of loaded) {
  const id = (l.raw as { id?: unknown } | undefined)?.id
  if (typeof id === 'string')
    idFiles.set(id, [...(idFiles.get(id) ?? []), l.file])
}
for (const [id, files] of idFiles) {
  if (files.length > 1)
    for (const f of files)
      error(
        f,
        '$.id',
        `id "${id}" is also used in ${files.filter((x) => x !== f).join(', ')}`,
      )
}

const publishedIds = new Set(
  loaded.filter((l) => l.story && !l.draft).map((l) => l.story!.id),
)

function checkStory(file: string, s: Story) {
  // sources: unique ids, every reference known, unreferenced → warning
  const sourceIds = new Set<string>()
  s.sources.forEach((src, i) => {
    if (sourceIds.has(src.id))
      error(file, `$.sources[${i}].id`, `duplicate source id "${src.id}"`)
    sourceIds.add(src.id)
  })
  const refs = sourceRefs(s)
  for (const ref of refs) {
    if (ref.source !== TODO && !sourceIds.has(ref.source)) {
      error(file, ref.path, `unknown source id "${ref.source}"`)
    }
  }
  const referenced = new Set(refs.map((r) => r.source))
  s.sources.forEach((src, i) => {
    if (!referenced.has(src.id))
      warn(file, `$.sources[${i}]`, `source "${src.id}" is never referenced`)
  })

  // timeline
  s.timeline.forEach((t, i) => {
    if ((t.status === 'done' || t.status === 'current') && !t.source)
      error(file, `$.timeline[${i}].source`, `required for "${t.status}" items`)
  })
  const current = s.timeline.filter((t) => t.status === 'current').length
  if (current !== 1)
    error(
      file,
      '$.timeline',
      `needs exactly one "current" item (found ${current})`,
    )
  let prevDate: string | undefined
  s.timeline.forEach((t, i) => {
    if (!t.date || !isIsoDate(t.date)) return
    if (prevDate && t.date < prevDate)
      error(
        file,
        `$.timeline[${i}].date`,
        `${t.date} is earlier than the item before it (${prevDate})`,
      )
    prevDate = t.date
  })

  // featured completeness
  if (s.featured) {
    if (s.meaning.length < 2)
      error(file, '$.meaning', 'featured stories need ≥ 2 items')
    if (s.affects.length < 2)
      error(file, '$.affects', 'featured stories need ≥ 2 items')
    const missing = EVIDENCE_STEPS.filter(
      (step) => !s.evidence.some((e) => e.step === step),
    )
    if (missing.length)
      error(
        file,
        '$.evidence',
        `featured stories need all four steps; missing: ${missing.join(', ')}`,
      )
    if (s.participate.length < 1)
      error(file, '$.participate', 'featured stories need ≥ 1 entry')
    if (!s.changes?.length && !s.keyNumbers?.length)
      error(file, '$', 'featured stories need "changes" or "keyNumbers"')
  }
  s.evidence.forEach((e, i) => {
    if (s.evidence.findIndex((x) => x.step === e.step) !== i)
      warn(file, `$.evidence[${i}].step`, `step "${e.step}" appears twice`)
  })

  // links
  s.relatedStoryIds?.forEach((id, i) => {
    if (id === s.id)
      warn(file, `$.relatedStoryIds[${i}]`, 'story links to itself')
    else if (!publishedIds.has(id))
      error(
        file,
        `$.relatedStoryIds[${i}]`,
        `no published story with id "${id}"`,
      )
  })
  s.participate.forEach((p, i) => {
    if (!channelIds.has(p.channel))
      error(
        file,
        `$.participate[${i}].channel`,
        `channel "${p.channel}" is not in channels.json`,
      )
  })
}

function lintNeutrality(file: string, raw: unknown) {
  walkStrings(raw, [], (path, s) => {
    // our own text only: not reviewer notes, not the titles of cited works
    if (path.includes('verify') || path[0] === 'sources') return
    for (const m of s.matchAll(EVALUATIVE)) {
      warn(
        file,
        jsonPath(path),
        `evaluative word "${m[0]}" — use neutral wording`,
      )
    }
  })
}

const drafts: string[] = []
for (const l of loaded) {
  if (l.draft) {
    drafts.push(l.file)
    continue
  }
  if (l.story) checkStory(l.file, l.story)
  if (l.raw !== undefined) {
    lintNeutrality(l.file, l.raw)
    strictTodoCount += collectTodosAndNotes(l.file, l.raw)
  }
}

// ---- report ----------------------------------------------------------------

console.log(
  bold(`Data check${strict ? ' (strict)' : ''}`) +
    dim(
      ` — ${publishedIds.size} published stories, ${drafts.length} drafts, ${channels.length} channels`,
    ),
)
if (drafts.length)
  console.log(dim(`  drafts (checked by schema only): ${drafts.join(', ')}`))

printGroup('Errors', errors, red)
printGroup('Warnings', warnings, yellow)
printGroup(TODO, todos, yellow)
printGroup('verify notes', notes, dim)

const strictFailures: string[] = []
if (strict) {
  if (strictTodoCount > 0)
    strictFailures.push(`${strictTodoCount} ${TODO} left in published stories`)
  if (taxRules && !taxRules.verified)
    strictFailures.push('taxRules.verified is false')
}

console.log(
  `\n${errors.length} errors · ${warnings.length} warnings · ${strictTodoCount} ${TODO} in published stories (${todos.length} total) · ${notes.length} verify notes`,
)
if (errors.length || strictFailures.length) {
  for (const f of strictFailures) console.log(red(`✖ strict: ${f}`))
  console.log(red('✖ check failed'))
  process.exitCode = 1
} else {
  console.log(green('✓ check passed'))
}
