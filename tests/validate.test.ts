import { describe, expect, it } from 'vitest'
import { TODO, type Story } from '../src/data/schema'
import {
  evaluativeWords,
  taxRulesProblems,
  todosAndNotes,
  validateStory,
} from '../src/lib/validate'
import { getStory, stories, taxRules } from './fixtures'

const base = getStory('tax-package-2026')!
const clone = (s: Story): Story => structuredClone(s)
const codes = (raw: unknown, ctx = {}) =>
  validateStory(raw, ctx).errors.map((e) => `${e.code} ${e.path}`)

describe('validateStory', () => {
  it('passes every seed story', () => {
    const ids = new Set(stories.map((s) => s.id))
    const channelIds = new Set(base.participate.map((p) => p.channel))
    for (const s of stories) {
      const report = validateStory(s, { storyIds: ids })
      expect(report.errors, s.id).toEqual([])
      expect(report.story?.id).toBe(s.id)
    }
    expect(validateStory(base, { storyIds: ids, channelIds }).errors).toEqual(
      [],
    )
  })

  it('reports schema issues with their path and zod issue', () => {
    const s = clone(base) as unknown as Record<string, unknown>
    s.title = ''
    s.publishedAt = '2026-02-30'
    const report = validateStory(s)
    expect(report.story).toBeNull()
    expect(report.errors.map((e) => `${e.code} ${e.path}`)).toEqual([
      'schema $.title',
      'schema $.publishedAt',
    ])
    expect(report.errors[0].issue?.code).toBe('too_small')
  })

  it('finds unknown and duplicate sources', () => {
    const s = clone(base)
    s.meaning[1].source = 'nope'
    s.sources.push({ ...s.sources[0] })
    expect(codes(s)).toEqual([
      'duplicate_source $.sources[6].id',
      'unknown_source $.meaning[1].source',
    ])
  })

  it('allows TODO_VERIFY as a source and lists it as a TODO', () => {
    const s = clone(base)
    s.meaning[0].source = TODO
    expect(codes(s)).toEqual([])
    expect(
      validateStory(s).todos.some((t) => t.path === '$.meaning[0].source'),
    ).toBe(true)
  })

  it('checks the timeline', () => {
    const s = clone(base)
    s.timeline[1].status = 'done'
    delete s.timeline[0].source
    s.timeline[3].date = '2026-01-01'
    expect(codes(s)).toEqual([
      'timeline_source_required $.timeline[0].source',
      'timeline_current_count $.timeline',
      'timeline_order $.timeline[3].date',
    ])
  })

  it('asks more of featured stories', () => {
    const s = clone(base)
    s.meaning = s.meaning.slice(0, 1)
    s.affects = s.affects.slice(0, 1)
    s.evidence = s.evidence.slice(0, 2)
    s.participate = []
    delete s.changes
    delete s.calculator
    expect(codes(s)).toEqual([
      'featured_meaning $.meaning',
      'featured_affects $.affects',
      'featured_evidence $.evidence',
      'featured_participate $.participate',
      'featured_numbers $',
    ])
    s.featured = false
    expect(codes(s)).toEqual([])
  })

  it('checks related stories and channels only when it knows them', () => {
    const s = clone(base)
    s.relatedStoryIds = ['ghost', s.id]
    expect(codes(s)).toEqual([])
    expect(codes(s, { storyIds: new Set([s.id]) })).toEqual([
      'unknown_related $.relatedStoryIds[0]',
    ])
    expect(validateStory(s).warnings.map((w) => w.code)).toContain(
      'self_related',
    )
    expect(codes(s, { channelIds: new Set(['petition']) })).toEqual([
      'unknown_channel $.participate[0].channel',
    ])
  })
})

describe('todosAndNotes', () => {
  it('separates TODO values from reviewer notes', () => {
    const { todos, notes } = todosAndNotes({
      a: TODO,
      b: `зүйл: ${TODO}`,
      c: { verify: `note ${TODO}` },
    })
    expect(todos).toEqual([
      { code: 'todo', path: '$.a', message: '' },
      { code: 'todo', path: '$.b', message: `зүйл: ${TODO}` },
    ])
    expect(notes.map((n) => n.path)).toEqual(['$.c.verify'])
  })
})

describe('evaluativeWords', () => {
  it('flags evaluative stems with suffixes, not source titles or notes', () => {
    const found = evaluativeWords({
      title: 'Гайхалтай шийдвэр',
      sources: [{ title: 'Шилдэг' }],
      meaning: [{ text: 'Энгийн', verify: 'шилдэг' }],
    })
    expect(found.map((f) => f.path)).toEqual(['$.title'])
  })
})

describe('taxRulesProblems', () => {
  it('accepts the seed rules', () => {
    expect(taxRulesProblems(taxRules)).toEqual([])
  })

  it('finds brackets out of order and verified rules with open rates', () => {
    const rules = structuredClone(taxRules)
    rules.years[0].brackets[1].upTo = 1
    rules.years[1].brackets[0].rate = TODO
    expect(taxRulesProblems(rules).map((p) => p.code)).toEqual([
      'verified_with_todo',
      'brackets_order',
    ])
  })
})
