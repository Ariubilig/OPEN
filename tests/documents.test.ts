import { describe, expect, it } from 'vitest'
import {
  asPublished,
  newStory,
  renameSource,
} from '../src/admin/editor/documents'
import { validateStory } from '../src/lib/validate'
import { getStory } from './fixtures'

describe('renameSource', () => {
  it('renames the source and every reference to it, nothing else', () => {
    const story = getStory('tax-package-2026')!
    const renamed = renameSource(
      story,
      0,
      'ikon-tax',
      'ikon-2026',
    ) as typeof story
    expect(renamed.sources[0].id).toBe('ikon-2026')
    expect(renamed.summary.source).toBe('ikon-2026')
    expect(renamed.changes![0].plainBefore.source).toBe('ikon-2026')
    expect(renamed.changes![0].lawSource).toBe('legalinfo-pit')
    expect(renamed.sources[1].id).toBe('legalinfo-pit')
    expect(JSON.stringify(renamed)).not.toContain('"ikon-tax"')
    expect(validateStory(renamed).errors).toEqual([])
  })
})

describe('asPublished', () => {
  it('fills a missing or invalid publishedAt with today', () => {
    expect(asPublished({ id: 'x' }, '2026-09-27')).toEqual({
      id: 'x',
      publishedAt: '2026-09-27',
    })
    expect(asPublished({ publishedAt: '2026-02-30' }, '2026-09-27')).toEqual({
      publishedAt: '2026-09-27',
    })
    const doc = { publishedAt: '2026-01-01' }
    expect(asPublished(doc, '2026-09-27')).toBe(doc)
  })
})

describe('newStory', () => {
  it('starts with the typed fields and TODOs, and says what is missing', () => {
    const doc = newStory({
      id: 'budget-2028',
      type: 'Хуулийн төсөл',
      stage: 'Өргөн мэдүүлсэн',
      title: 'Шинэ мэдээ',
      today: '2026-09-27',
    })
    const report = validateStory(doc)
    expect(report.errors.map((e) => e.path)).toEqual(['$.topics', '$.sources'])
    expect(report.todos.length).toBe(4)
  })
})
