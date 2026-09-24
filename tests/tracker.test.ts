import { describe, expect, it } from 'vitest'
import { stories } from '../src/data'
import type { Story, TimelineItem } from '../src/data/schema'
import {
  ago,
  recentEvents,
  unscheduledNext,
  upcomingByDate,
} from '../src/lib/tracker'

// A minimal story: only the fields the tracker reads matter here.
function story(id: string, timeline: TimelineItem[]): Story {
  return { ...stories[0], id, timeline }
}
const step = (
  date: string | null,
  status: TimelineItem['status'],
  label = `${status} ${date}`,
): TimelineItem => ({ date, status, label })

describe('upcomingByDate', () => {
  const a = story('a', [
    step('2026-09-01', 'done'),
    step('2027-01-01', 'upcoming'),
    step('2028-01-01', 'upcoming'),
  ])
  const b = story('b', [
    step('2027-01-01', 'upcoming'),
    step(null, 'upcoming'),
    step('TODO_VERIFY', 'upcoming'),
    step('2026-01-01', 'upcoming'), // already past: left out
  ])

  it('groups dated upcoming steps by date, soonest first, stories in feed order', () => {
    const groups = upcomingByDate([a, b], '2026-09-24')
    expect(groups.map((g) => g.date)).toEqual(['2027-01-01', '2028-01-01'])
    expect(groups[0].events.map((e) => e.story.id)).toEqual(['a', 'b'])
  })

  it('keeps only the first dates', () => {
    expect(upcomingByDate([a, b], '2026-09-24', 1)).toHaveLength(1)
  })
})

describe('recentEvents', () => {
  it('takes the latest past step of each story, newest first', () => {
    const a = story('a', [
      step('2026-08-31', 'done', 'submitted'),
      step('2026-09-15', 'current', 'in session'),
      step('2027-01-01', 'upcoming'),
    ])
    const b = story('b', [step('2026-09-21', 'current', 'started')])
    const c = story('c', [step(null, 'current'), step('TODO_VERIFY', 'done')])
    const events = recentEvents([a, b, c], '2026-09-24')
    expect(events.map((e) => [e.story.id, e.item.label])).toEqual([
      ['b', 'started'],
      ['a', 'in session'],
    ])
  })

  it('ignores steps dated after today', () => {
    const a = story('a', [step('2026-10-01', 'done')])
    expect(recentEvents([a], '2026-09-24')).toEqual([])
  })

  it('works on the real data', () => {
    const events = recentEvents(stories, '2026-09-24')
    expect(events.length).toBeGreaterThan(0)
    const dates = events.map((e) => e.date)
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe('unscheduledNext', () => {
  it('lists a story only when its next step has no date', () => {
    const dated = story('dated', [
      step('2026-09-01', 'current'),
      step('2027-01-01', 'upcoming'),
      step(null, 'upcoming'),
    ])
    const open = story('open', [
      step('2026-09-15', 'current'),
      step(null, 'upcoming', 'first reading'),
      step(null, 'upcoming', 'final reading'),
    ])
    const finished = story('finished', [step('2026-07-02', 'current')])
    expect(
      unscheduledNext([dated, open, finished]).map((e) => [
        e.story.id,
        e.item.label,
      ]),
    ).toEqual([['open', 'first reading']])
  })
})

describe('ago', () => {
  it('says today, yesterday, days, then the date', () => {
    expect(ago('2026-09-24', '2026-09-24')).toBe('Өнөөдөр')
    expect(ago('2026-09-23', '2026-09-24')).toBe('Өчигдөр')
    expect(ago('2026-09-21', '2026-09-24')).toBe('3 хоногийн өмнө')
    expect(ago('2026-06-26', '2026-09-24')).toBe('2026.06.26')
  })
})
