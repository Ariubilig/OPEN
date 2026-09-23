import { describe, expect, it } from 'vitest'
import { getStory } from '../src/data'
import type { TimelineItem } from '../src/data/schema'
import { countdown, nextDatedIndex, stageSummary } from '../src/lib/timeline'

const step = (
  status: TimelineItem['status'],
  date: TimelineItem['date'],
  label: string = status,
): TimelineItem => ({ status, date, label })

describe('stageSummary', () => {
  it('returns the current and the next upcoming step', () => {
    const tax = getStory('tax-package-2026')!
    const { current, next } = stageSummary(tax.timeline)
    expect(current?.status).toBe('current')
    expect(next?.status).toBe('upcoming')
    expect(tax.timeline.indexOf(next!)).toBe(tax.timeline.indexOf(current!) + 1)
  })

  it('falls back to the last done step when none is current', () => {
    const { current, next } = stageSummary([
      step('done', '2026-01-01', 'a'),
      step('done', '2026-02-01', 'b'),
      step('upcoming', null, 'c'),
    ])
    expect(current?.label).toBe('b')
    expect(next?.label).toBe('c')
  })

  it('has no next step when everything is done', () => {
    expect(stageSummary([step('done', '2026-01-01')]).next).toBeUndefined()
  })
})

describe('nextDatedIndex', () => {
  it('skips unscheduled and TODO_VERIFY dates', () => {
    expect(
      nextDatedIndex([
        step('current', '2026-01-01'),
        step('upcoming', null),
        step('upcoming', 'TODO_VERIFY'),
        step('upcoming', '2027-01-01'),
      ]),
    ).toBe(3)
  })
})

describe('countdown', () => {
  it('counts whole days either way', () => {
    expect(countdown('2027-01-01', '2026-09-23')).toBe('100 хоногийн дараа')
    expect(countdown('2026-09-23', '2026-09-23')).toBe('Өнөөдөр')
    expect(countdown('2026-09-20', '2026-09-23')).toBe('3 хоногийн өмнө')
  })
})
