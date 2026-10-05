import { describe, expect, it } from 'vitest'
import { copy } from '../src/copy'
import { TODO } from '../src/data/schema'
import { escapeText, foldLine, icsCalendar, stepEvent } from '../src/lib/ics'

const bytes = (s: string) => new TextEncoder().encode(s).length
const NOW = new Date('2026-10-05T03:04:05.678Z')

describe('escapeText', () => {
  it('escapes what iCalendar text reserves', () => {
    expect(escapeText('a\\b; c, d\ne')).toBe('a\\\\b\\; c\\, d\\ne')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds at 75 octets without splitting a Cyrillic letter', () => {
    const line = `SUMMARY:${'Өө'.repeat(60)}`
    const parts = foldLine(line).split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const [i, part] of parts.entries()) {
      expect(bytes(part)).toBeLessThanOrEqual(75)
      if (i > 0) expect(part.startsWith(' ')).toBe(true)
    }
    // unfolding gives the line back, every letter whole
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line)
  })
})

describe('icsCalendar', () => {
  const ics = icsCalendar(
    [
      {
        uid: 'budget-2027-3@tod.example',
        date: '2026-12-31',
        title: 'Эцсийн хэлэлцүүлэг — Төсөв',
        description: 'Мөр 1\n\nМөр 2',
        url: 'https://tod.example/story/budget-2027',
      },
    ],
    NOW,
  )

  it('is one all-day event with CRLF line ends', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replaceAll('\r\n', '')).not.toContain('\n')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n')
    // the day after, across the year end
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n')
    expect(ics).toContain('DTSTAMP:20261005T030405Z\r\n')
    expect(ics).toContain('UID:budget-2027-3@tod.example\r\n')
    expect(ics).toContain('DESCRIPTION:Мөр 1\\n\\nМөр 2\r\n')
  })
})

describe('stepEvent', () => {
  const event = stepEvent(
    { id: 'tax-package-2026', title: `Хууль ${TODO}` },
    { label: 'Мөрдөж эхэлнэ', date: '2027-01-01', note: 'Тайлбар' },
    3,
    'https://tod.example',
  )

  it('names the step and the story, and links back', () => {
    expect(event.title).toBe(`Мөрдөж эхэлнэ — Хууль ${copy.placeholder}`)
    expect(event.uid).toBe('tax-package-2026-3@tod.example')
    expect(event.url).toBe('https://tod.example/story/tax-package-2026')
  })

  it('carries the disclaimers and never TODO_VERIFY', () => {
    expect(event.description).toContain(copy.story.disclaimer)
    expect(event.description).toContain(copy.footer.independent)
    expect(event.description).toContain('Тайлбар')
    expect(JSON.stringify(event)).not.toContain(TODO)
  })
})
