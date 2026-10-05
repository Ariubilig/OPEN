import { describe, expect, it } from 'vitest'
import {
  changedSince,
  parseFollowing,
  parseSeen,
  snapshotOf,
  toggled,
} from '../src/lib/following'

describe('parseFollowing', () => {
  it('reads a stored list of ids', () => {
    expect(parseFollowing('["a","b"]')).toEqual(['a', 'b'])
  })

  it('treats missing or broken storage as an empty list', () => {
    expect(parseFollowing(null)).toEqual([])
    expect(parseFollowing('{oops')).toEqual([])
    expect(parseFollowing('{"a":1}')).toEqual([])
  })

  it('drops non-strings and duplicates', () => {
    expect(parseFollowing('["a",1,null,"a","b"]')).toEqual(['a', 'b'])
  })
})

describe('toggled', () => {
  it('adds a new id first and removes a followed one', () => {
    expect(toggled(['a'], 'b')).toEqual(['b', 'a'])
    expect(toggled(['b', 'a'], 'b')).toEqual(['a'])
  })
})

describe('parseSeen', () => {
  it('reads stored snapshots and drops malformed ones', () => {
    expect(
      parseSeen(
        '{"a":{"stage":"Батлагдсан","step":"x"},"b":{"stage":1},"c":null}',
      ),
    ).toEqual({ a: { stage: 'Батлагдсан', step: 'x' } })
    expect(parseSeen(null)).toEqual({})
    expect(parseSeen('[1]')).toEqual({})
    expect(parseSeen('{oops')).toEqual({})
  })
})

describe('snapshotOf and changedSince', () => {
  const story = {
    stage: 'Анхны хэлэлцүүлэг' as const,
    timeline: [
      { date: '2026-09-01', label: 'Өргөн мэдүүлсэн', status: 'done' as const },
      {
        date: '2026-10-01',
        label: 'Анхны хэлэлцүүлэг',
        status: 'current' as const,
      },
      { date: null, label: 'Эцсийн хэлэлцүүлэг', status: 'upcoming' as const },
    ],
  }

  it('takes the stage and the current step', () => {
    expect(snapshotOf(story)).toEqual({
      stage: 'Анхны хэлэлцүүлэг',
      step: 'Анхны хэлэлцүүлэг',
    })
  })

  it('says what the reader saw when the stage or the step moved', () => {
    const now = snapshotOf(story)
    const before = { stage: 'Өргөн мэдүүлсэн', step: 'Өргөн мэдүүлсэн' }
    expect(changedSince(before, now)).toEqual(before)
    expect(changedSince({ ...now, step: 'other' }, now)).not.toBeNull()
  })

  it('says nothing when nothing moved or nothing was recorded', () => {
    expect(changedSince(snapshotOf(story), snapshotOf(story))).toBeNull()
    expect(changedSince(undefined, snapshotOf(story))).toBeNull()
  })
})
