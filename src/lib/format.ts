import { DEMO_TODAY } from '../config'

const DAY_MS = 86_400_000

/** 1234567 → '1,234,567' — comma thousands separators whatever the browser locale. */
export function formatThousands(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '−' : ''
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 12080 → '12,080₮' */
export function formatMNT(n: number): string {
  return `${formatThousands(n)}₮`
}

/** '2026-06-26' → '2026.06.26'. Anything else is returned unchanged. */
export function formatDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.replaceAll('-', '.') : iso
}

/** DEMO_TODAY when set, otherwise today's date in Ulaanbaatar as 'YYYY-MM-DD'. */
export function today(now: Date = new Date()): string {
  if (DEMO_TODAY) return DEMO_TODAY
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
  }).format(now)
}

function utcDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). Time-zone independent. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS)
}

/** A timestamp as '2026.09.27 19:05' in Ulaanbaatar time (the admin's lists and history). */
export function formatDateTime(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}
