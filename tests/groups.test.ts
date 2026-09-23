import { describe, expect, it } from 'vitest'
import { stories } from '../src/data'
import { GROUPS } from '../src/data/schema'
import { groupCounts, parseGroup, storiesFor } from '../src/lib/groups'

describe('parseGroup', () => {
  it('accepts schema groups only', () => {
    expect(parseGroup('Оюутан')).toBe('Оюутан')
    expect(parseGroup('оюутан')).toBeNull()
    expect(parseGroup(null)).toBeNull()
  })
})

describe('groupCounts', () => {
  it('lists only groups that some story affects, in schema order', () => {
    const counts = groupCounts(stories)
    expect(counts.length).toBeGreaterThan(0)
    expect(counts.every((c) => c.count > 0)).toBe(true)
    const order = counts.map((c) => GROUPS.indexOf(c.group))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })
})

describe('storiesFor', () => {
  it('returns each story with only the sentences for that group', () => {
    for (const { group, count } of groupCounts(stories)) {
      const found = storiesFor(stories, group)
      expect(found.length).toBe(count)
      for (const { story, affects } of found) {
        expect(affects.length).toBeGreaterThan(0)
        expect(affects.every((a) => a.group === group)).toBe(true)
        expect(story.affects).toEqual(expect.arrayContaining(affects))
      }
    }
  })

  it('keeps feed order', () => {
    const found = storiesFor(stories, 'Иргэн').map((x) => x.story)
    const feedOrder = stories.filter((s) => found.includes(s))
    expect(found).toEqual(feedOrder)
  })
})
