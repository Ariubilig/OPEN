import { copy } from '../copy'
import { isIsoDate, type TimelineItem } from '../data/schema'
import { daysBetween } from './format'

/** "100 хоногийн дараа" / "Өнөөдөр" / "3 хоногийн өмнө" from `now` to `date` (both YYYY-MM-DD). */
export function countdown(date: string, now: string): string {
  const days = daysBetween(now, date)
  if (days === 0) return copy.timeline.today
  return days > 0 ? copy.timeline.inDays(days) : copy.timeline.daysAgo(-days)
}

/**
 * Where a document is: the current step (or, when none is marked current, the last done one)
 * and the next upcoming step.
 */
export function stageSummary(timeline: TimelineItem[]): {
  current: TimelineItem | undefined
  next: TimelineItem | undefined
} {
  const current =
    timeline.find((t) => t.status === 'current') ??
    timeline.findLast((t) => t.status === 'done')
  const next = timeline.find((t) => t.status === 'upcoming')
  return { current, next }
}

/** Index of the first upcoming step with a real date — the one that gets a countdown. */
export function nextDatedIndex(timeline: TimelineItem[]): number {
  return timeline.findIndex(
    (t) => t.status === 'upcoming' && t.date !== null && isIsoDate(t.date),
  )
}
