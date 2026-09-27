// Story rules shared by `npm run check` (seed files) and the admin editor (working copies).
// The database runs the same rules when a story is published (private.story_problems() in
// supabase/migrations/*_story_validation.sql); error codes are the same on both sides.
import type { z } from 'zod'
import {
  EVIDENCE_STEPS,
  isIsoDate,
  jsonPath,
  StorySchema,
  TODO,
  type Story,
  type TaxRules,
} from '../data/schema'
import { sourceRefs } from './sources'

export type ErrorCode =
  | 'schema'
  | 'duplicate_source'
  | 'unknown_source'
  | 'timeline_source_required'
  | 'timeline_current_count'
  | 'timeline_order'
  | 'featured_meaning'
  | 'featured_affects'
  | 'featured_evidence'
  | 'featured_participate'
  | 'featured_numbers'
  | 'unknown_related'
  | 'unknown_channel'

export type WarningCode =
  | 'unused_source'
  | 'duplicate_evidence_step'
  | 'self_related'
  | 'evaluative_word'

export type Finding<C extends string = string> = {
  code: C
  /** JSON path, e.g. `$.meaning[2].source` */
  path: string
  /** English, for the command line; the admin shows its own Mongolian text per code */
  message: string
  /** the zod issue behind a `schema` error (the admin words its message from it) */
  issue?: z.core.$ZodIssue
}

export type StoryReport = {
  /** the parsed story when the schema passes */
  story: Story | null
  errors: Finding<ErrorCode>[]
  warnings: Finding<WarningCode>[]
  /** every TODO_VERIFY, with the surrounding text when it sits inside a longer string */
  todos: Finding<'todo'>[]
  /** every `verify` note for the reviewer */
  notes: Finding<'note'>[]
}

export type StoryContext = {
  /** ids of stories that exist; related links are checked against it when given */
  storyIds?: ReadonlySet<string>
  /** ids of the official channels; participate entries are checked against it when given */
  channelIds?: ReadonlySet<string>
}

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

/** Visit every string in a JSON value with its path. */
export function walkStrings(
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

/** TODO_VERIFY values and `verify` notes of any JSON document. */
export function todosAndNotes(raw: unknown): {
  todos: Finding<'todo'>[]
  notes: Finding<'note'>[]
} {
  const todos: Finding<'todo'>[] = []
  const notes: Finding<'note'>[] = []
  walkStrings(raw, [], (path, s) => {
    if (path.includes('verify')) {
      notes.push({ code: 'note', path: jsonPath(path), message: s })
    } else if (s.includes(TODO)) {
      todos.push({
        code: 'todo',
        path: jsonPath(path),
        message: s === TODO ? '' : s,
      })
    }
  })
  return { todos, notes }
}

/** Evaluative words in our own text (not reviewer notes, not the titles of cited works). */
export function evaluativeWords(raw: unknown): Finding<'evaluative_word'>[] {
  const found: Finding<'evaluative_word'>[] = []
  walkStrings(raw, [], (path, s) => {
    if (path.includes('verify') || path[0] === 'sources') return
    for (const m of s.matchAll(EVALUATIVE)) {
      found.push({
        code: 'evaluative_word',
        path: jsonPath(path),
        message: `evaluative word "${m[0]}" — use neutral wording`,
      })
    }
  })
  return found
}

/** The publish rules for a story that already passed the schema. */
export function storyRules(
  s: Story,
  ctx: StoryContext = {},
): { errors: Finding<ErrorCode>[]; warnings: Finding<WarningCode>[] } {
  const errors: Finding<ErrorCode>[] = []
  const warnings: Finding<WarningCode>[] = []
  const error = (code: ErrorCode, path: string, message: string) =>
    errors.push({ code, path, message })
  const warn = (code: WarningCode, path: string, message: string) =>
    warnings.push({ code, path, message })

  // sources: unique ids, every reference known, unreferenced → warning
  const sourceIds = new Set<string>()
  s.sources.forEach((src, i) => {
    if (sourceIds.has(src.id))
      error(
        'duplicate_source',
        `$.sources[${i}].id`,
        `duplicate source id "${src.id}"`,
      )
    sourceIds.add(src.id)
  })
  const refs = sourceRefs(s)
  for (const ref of refs) {
    if (ref.source !== TODO && !sourceIds.has(ref.source))
      error('unknown_source', ref.path, `unknown source id "${ref.source}"`)
  }
  const referenced = new Set(refs.map((r) => r.source))
  s.sources.forEach((src, i) => {
    if (!referenced.has(src.id))
      warn(
        'unused_source',
        `$.sources[${i}]`,
        `source "${src.id}" is never referenced`,
      )
  })

  // timeline
  s.timeline.forEach((t, i) => {
    if ((t.status === 'done' || t.status === 'current') && !t.source)
      error(
        'timeline_source_required',
        `$.timeline[${i}].source`,
        `required for "${t.status}" items`,
      )
  })
  const current = s.timeline.filter((t) => t.status === 'current').length
  if (current !== 1)
    error(
      'timeline_current_count',
      '$.timeline',
      `needs exactly one "current" item (found ${current})`,
    )
  let prevDate: string | undefined
  s.timeline.forEach((t, i) => {
    if (!t.date || !isIsoDate(t.date)) return
    if (prevDate && t.date < prevDate)
      error(
        'timeline_order',
        `$.timeline[${i}].date`,
        `${t.date} is earlier than the item before it (${prevDate})`,
      )
    prevDate = t.date
  })

  // featured stories are full explainers
  if (s.featured) {
    if (s.meaning.length < 2)
      error('featured_meaning', '$.meaning', 'featured stories need ≥ 2 items')
    if (s.affects.length < 2)
      error('featured_affects', '$.affects', 'featured stories need ≥ 2 items')
    const missing = EVIDENCE_STEPS.filter(
      (step) => !s.evidence.some((e) => e.step === step),
    )
    if (missing.length)
      error(
        'featured_evidence',
        '$.evidence',
        `featured stories need all four steps; missing: ${missing.join(', ')}`,
      )
    if (s.participate.length < 1)
      error(
        'featured_participate',
        '$.participate',
        'featured stories need ≥ 1 entry',
      )
    if (!s.changes?.length && !s.keyNumbers?.length)
      error(
        'featured_numbers',
        '$',
        'featured stories need "changes" or "keyNumbers"',
      )
  }
  s.evidence.forEach((e, i) => {
    if (s.evidence.findIndex((x) => x.step === e.step) !== i)
      warn(
        'duplicate_evidence_step',
        `$.evidence[${i}].step`,
        `step "${e.step}" appears twice`,
      )
  })

  // links
  s.relatedStoryIds?.forEach((id, i) => {
    if (id === s.id)
      warn('self_related', `$.relatedStoryIds[${i}]`, 'story links to itself')
    else if (ctx.storyIds && !ctx.storyIds.has(id))
      error(
        'unknown_related',
        `$.relatedStoryIds[${i}]`,
        `no story with id "${id}"`,
      )
  })
  s.participate.forEach((p, i) => {
    if (ctx.channelIds && !ctx.channelIds.has(p.channel))
      error(
        'unknown_channel',
        `$.participate[${i}].channel`,
        `channel "${p.channel}" does not exist`,
      )
  })

  return { errors, warnings }
}

/** Everything about one story document: schema, publish rules, wording, open TODOs and notes. */
export function validateStory(
  raw: unknown,
  ctx: StoryContext = {},
): StoryReport {
  const { todos, notes } = todosAndNotes(raw)
  const parsed = StorySchema.safeParse(raw)
  if (!parsed.success) {
    return {
      story: null,
      errors: parsed.error.issues.map((issue) => ({
        code: 'schema',
        path: jsonPath(issue.path),
        message: issue.message,
        issue,
      })),
      warnings: evaluativeWords(raw),
      todos,
      notes,
    }
  }
  const { errors, warnings } = storyRules(parsed.data, ctx)
  return {
    story: parsed.data,
    errors,
    warnings: [...warnings, ...evaluativeWords(raw)],
    todos,
    notes,
  }
}

export type TaxRulesCode = 'brackets_order' | 'verified_with_todo'

/** Tax rules that parse but cannot be right: brackets out of order, "verified" with open rates. */
export function taxRulesProblems(rules: TaxRules): Finding<TaxRulesCode>[] {
  const problems: Finding<TaxRulesCode>[] = []
  const todoRates = rules.years.flatMap((y, yi) =>
    y.brackets
      .map((b, bi) => ({ b, path: `$.years[${yi}].brackets[${bi}].rate` }))
      .filter((x) => x.b.rate === TODO),
  )
  if (rules.verified && todoRates.length)
    problems.push({
      code: 'verified_with_todo',
      path: '$.verified',
      message: `is true but ${todoRates.length} rate(s) are still ${TODO}`,
    })
  rules.years.forEach((y, yi) => {
    let prev = 0
    y.brackets.forEach((b, bi) => {
      if (b.upTo !== null && b.upTo <= prev)
        problems.push({
          code: 'brackets_order',
          path: `$.years[${yi}].brackets[${bi}].upTo`,
          message: 'brackets must increase',
        })
      if (b.upTo !== null) prev = b.upTo
    })
  })
  return problems
}
