// "Календарьт нэмэх": a timeline step as an all-day event in an iCalendar file (RFC 5545), made
// in the browser from the story data. Calendar apps on phones and computers open it.
import { APP_NAME } from '../config'
import { copy } from '../copy'
import { TODO } from '../data/schema'

export type CalendarEvent = {
  /** stable, so importing the file again updates the same event */
  uid: string
  /** YYYY-MM-DD */
  date: string
  title: string
  description: string
  url: string
}

/** TEXT values: backslash, semicolon, comma and line breaks escaped (RFC 5545 §3.3.11). */
export function escapeText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Lines longer than 75 octets continue on the next line after a space (§3.1). Counted in UTF-8
 * bytes, and never inside a character: Cyrillic letters take two bytes each.
 */
export function foldLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // the first line holds 75 octets, continuation lines 74 after their leading space
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

const compactDate = (iso: string) => iso.replaceAll('-', '')

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** 2026-10-05T03:04:05.678Z → 20261005T030405Z */
const stamp = (now: Date) =>
  now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** A calendar file with all-day events; lines end in CRLF as the format requires. */
export function icsCalendar(events: CalendarEvent[], now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeText(APP_NAME)}//MN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      `URL:${e.url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

/** Text from the story data for the calendar: TODO_VERIFY as its label (no placeholder there). */
const plain = (s: string) => s.replaceAll(TODO, copy.placeholder)

/** One timeline step of a story as an event: the step, the story, the link and the disclaimer. */
export function stepEvent(
  story: { id: string; title: string },
  step: { label: string; date: string; note?: string },
  index: number,
  origin: string,
): CalendarEvent {
  const url = `${origin}/story/${story.id}`
  return {
    uid: `${story.id}-${index}@${new URL(origin).host}`,
    date: step.date,
    title: `${plain(step.label)} — ${plain(story.title)}`,
    description: [
      plain(story.title),
      ...(step.note ? [plain(step.note)] : []),
      url,
      copy.story.disclaimer,
      copy.footer.independent,
    ].join('\n\n'),
    url,
  }
}
