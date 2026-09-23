import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  formatDate,
  formatMNT,
  formatThousands,
  today,
} from '../src/lib/format'

describe('formatMNT', () => {
  it.each([
    [12080, '12,080₮'],
    [0, '0₮'],
    [999, '999₮'],
    [1000, '1,000₮'],
    [187920, '187,920₮'],
    [1234567, '1,234,567₮'],
    [2000000.4, '2,000,000₮'],
  ])('%d → %s', (n, expected) => {
    expect(formatMNT(n)).toBe(expected)
  })

  it('formats without the currency sign for inputs', () => {
    expect(formatThousands(20000000)).toBe('20,000,000')
  })
})

describe('formatDate', () => {
  it('uses dots', () => {
    expect(formatDate('2026-06-26')).toBe('2026.06.26')
  })
  it('leaves non-dates alone', () => {
    expect(formatDate('TODO_VERIFY')).toBe('TODO_VERIFY')
  })
})

describe('daysBetween', () => {
  it.each([
    ['2026-09-26', '2027-01-01', 97],
    ['2026-09-26', '2026-09-26', 0],
    ['2026-09-26', '2026-09-25', -1],
    ['2027-12-31', '2028-01-01', 1],
    ['2028-02-28', '2028-03-01', 2], // leap year
    ['2026-03-28', '2026-03-30', 2], // across a DST change in many time zones
  ])('%s → %s = %d', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected)
  })
})

describe('today', () => {
  it('uses the Ulaanbaatar calendar date (UTC+8)', () => {
    // 17:30 UTC on Sep 25 is already 01:30 on Sep 26 in Ulaanbaatar
    expect(today(new Date('2026-09-25T17:30:00Z'))).toBe('2026-09-26')
    expect(today(new Date('2026-09-25T15:59:00Z'))).toBe('2026-09-25')
  })

  it('returns YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
