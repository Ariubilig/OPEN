import { copy } from '../copy'
import { isIsoDate, type Story, type TimelineItem } from '../data/schema'
import { daysBetween, formatDate } from './format'

// "Шийдвэрүүд хаана явж байна?" on the feed: every date comes from a story's timeline.

export type TrackerEvent = { story: Story; item: TimelineItem; date: string }

function dated(item: TimelineItem): item is TimelineItem & { date: string } {
  return item.date !== null && isIsoDate(item.date)
}

/**
 * Upcoming steps with a real date from `now` on, grouped by date, soonest first.
 * Within a date the stories keep feed order.
 */
export function upcomingByDate(
  stories: Story[],
  now: string,
  maxDates = 3,
): { date: string; events: TrackerEvent[] }[] {
  const events = stories
    .flatMap((story) =>
      story.timeline
        .filter(dated)
        .filter((t) => t.status === 'upcoming' && t.date >= now)
        .map((item) => ({ story, item, date: item.date })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const byDate = new Map<string, TrackerEvent[]>()
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  return [...byDate]
    .slice(0, maxDates)
    .map(([date, list]) => ({ date, events: list }))
}

/**
 * The latest dated step of each story that has already happened (done or current, not after
 * `now`), newest first — one line per document.
 */
export function recentEvents(
  stories: Story[],
  now: string,
  limit = 5,
): TrackerEvent[] {
  const latest: TrackerEvent[] = []
  for (const story of stories) {
    let last: (TimelineItem & { date: string }) | undefined
    for (const t of story.timeline.filter(dated)) {
      if (t.status === 'upcoming' || t.date > now) continue
      if (!last || t.date >= last.date) last = t
    }
    if (last) latest.push({ story, item: last, date: last.date })
  }
  return latest.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

/** Stories whose next step has no date yet, with that step (the budget's next reading, …). */
export function unscheduledNext(
  stories: Story[],
): { story: Story; item: TimelineItem }[] {
  return stories.flatMap((story) => {
    const next = story.timeline.find((t) => t.status === 'upcoming')
    return next && !dated(next) ? [{ story, item: next }] : []
  })
}

/** "Өнөөдөр", "Өчигдөр", "5 хоногийн өмнө" within a month; the date itself after that. */
export function ago(date: string, now: string): string {
  const days = daysBetween(date, now)
  if (days <= 0) return copy.timeline.today
  if (days === 1) return copy.timeline.yesterday
  if (days <= 30) return copy.timeline.daysAgo(days)
  return formatDate(date)
}
