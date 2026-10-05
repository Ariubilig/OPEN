// Data checks for the seed files in supabase/seed/. Run: npm run check  |  npm run check:strict
//
//  - zod validation of every story (except _*.json), channels.json and taxRules.json
//  - the publish rules of src/lib/validate.ts for non-draft stories (the same rules the database
//    runs when a story is published, and the admin editor shows while typing)
//  - neutrality lint, and upcoming timeline steps whose date has passed (warnings)
//  - lists every TODO_VERIFY and every `verify` note, grouped by file
//  - --strict: any TODO_VERIFY in a non-draft story, or unverified tax rules, fails
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { z } from 'zod'
import {
  ChannelsSchema,
  jsonPath,
  StorySchema,
  TaxRulesSchema,
  TODO,
  type Channel,
} from '../src/data/schema'
import { today } from '../src/lib/format'
import {
  taxRulesProblems,
  todosAndNotes,
  validateStory,
  type Finding,
} from '../src/lib/validate'

const strict = process.argv.includes('--strict')
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const STORIES_DIR = 'supabase/seed/stories'
const CHANNELS_FILE = 'supabase/seed/channels.json'
const TAX_FILE = 'supabase/seed/taxRules.json'

// ---- output helpers --------------------------------------------------------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code: number) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s
const red = paint(31)
const yellow = paint(33)
const green = paint(32)
const dim = paint(2)
const bold = paint(1)

type Line = { file: string; path?: string; message: string }
const errors: Line[] = []
const warnings: Line[] = []
const todos: Line[] = []
const notes: Line[] = []
let strictTodoCount = 0

const error = (file: string, path: string | undefined, message: string) =>
  errors.push({ file, path, message })
const warn = (file: string, path: string | undefined, message: string) =>
  warnings.push({ file, path, message })
const lines = (file: string, findings: Finding[]): Line[] =>
  findings.map((f) => ({ file, path: f.path, message: f.message }))

function printGroup(
  title: string,
  items: Line[],
  color: (s: string) => string,
) {
  console.log(`\n${bold(color(`${title} (${items.length})`))}`)
  const byFile = new Map<string, Line[]>()
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

/** Record the TODO_VERIFY values and `verify` notes of one file. Returns the TODO count. */
function collectTodosAndNotes(file: string, raw: unknown): number {
  const found = todosAndNotes(raw)
  todos.push(
    ...found.todos.map((t) => ({
      file,
      path: t.path,
      message: t.message ? dim(`"${shorten(t.message)}"`) : '',
    })),
  )
  notes.push(...lines(file, found.notes))
  return found.todos.length
}

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
  errors.push(...lines(TAX_FILE, taxRulesProblems(taxRules)))
  if (!taxRules.verified) {
    warn(
      TAX_FILE,
      '$.verified',
      'tax rules are not verified (calculator shows a banner)',
    )
  }
  taxRules.years.forEach((y, yi) =>
    y.brackets.forEach((b, bi) => {
      if (b.rate === TODO)
        warn(
          TAX_FILE,
          `$.years[${yi}].brackets[${bi}].rate`,
          `${y.year}: rate is ${TODO}`,
        )
    }),
  )
}

// ---- stories ---------------------------------------------------------------

type Loaded = { file: string; raw: unknown; draft: boolean }

const loaded: Loaded[] = readdirSync(join(ROOT, STORIES_DIR))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort()
  .map((name) => {
    const file = `${STORIES_DIR}/${name}`
    const raw = readJson(file)
    const draft =
      typeof raw === 'object' &&
      raw !== null &&
      (raw as { draft?: unknown }).draft === true
    return { file, raw, draft }
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
  loaded
    .filter((l) => !l.draft && StorySchema.safeParse(l.raw).success)
    .map((l) => (l.raw as { id: string }).id),
)

const drafts: string[] = []
for (const l of loaded) {
  if (l.raw === undefined) continue
  if (l.draft) {
    // Drafts may be half-filled while the team works on them: schema only.
    drafts.push(l.file)
    validate(l.file, StorySchema, l.raw)
    continue
  }
  const report = validateStory(l.raw, {
    storyIds: publishedIds,
    channelIds,
    now: today(),
  })
  errors.push(...lines(l.file, report.errors))
  warnings.push(...lines(l.file, report.warnings))
  strictTodoCount += collectTodosAndNotes(l.file, l.raw)
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
