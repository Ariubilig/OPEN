import { describe, expect, it } from 'vitest'
import { getStory, stories } from '../src/data'
import { matchesQuery, normalize } from '../src/lib/search'

describe('normalize', () => {
  it('lower-cases, trims and drops thousands separators', () => {
    expect(normalize('  Сарын 792,000₮  ЦАЛИН ')).toBe('сарын 792000₮ цалин')
    expect(normalize('2,000,000')).toBe('2000000')
  })
})

describe('matchesQuery', () => {
  const tax = getStory('tax-package-2026')!

  it('matches everything for an empty query', () => {
    expect(stories.every((s) => matchesQuery(s, '   '))).toBe(true)
  })

  it('finds a story by a word from its title, in any case', () => {
    expect(matchesQuery(tax, 'ТАТВАР')).toBe(true)
  })

  it('finds amounts typed with or without separators', () => {
    expect(matchesQuery(tax, '792000')).toBe(true)
    expect(matchesQuery(tax, '792,000')).toBe(true)
  })

  it('needs every word of the query', () => {
    expect(matchesQuery(tax, 'татвар цалин')).toBe(true)
    expect(matchesQuery(tax, 'татвар шавьж')).toBe(false)
  })

  it('finds stories by the groups they affect', () => {
    const found = stories.filter((s) => matchesQuery(s, 'оюутан'))
    expect(found.map((s) => s.id)).toContain('student-contributions-2028')
  })

  it('never matches the TODO_VERIFY token', () => {
    expect(stories.some((s) => matchesQuery(s, 'todo_verify'))).toBe(false)
  })
})
