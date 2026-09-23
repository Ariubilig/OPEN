import { copy } from '../copy'
import { isIsoDate, TODO, type TimelineItem } from '../data/schema'
import { daysBetween, formatDate, today } from '../lib/format'
import { MarkedText } from './CitedText'
import DataText from './DataText'
import Placeholder from './Placeholder'

function countdown(date: string, now: string): string {
  const days = daysBetween(now, date)
  if (days === 0) return copy.timeline.today
  return days > 0 ? copy.timeline.inDays(days) : copy.timeline.daysAgo(-days)
}

function Dot({ status }: { status: TimelineItem['status'] }) {
  const base = 'relative z-10 mt-1 block rounded-full'
  if (status === 'done') return <span className={`${base} size-4 bg-accent`} />
  if (status === 'current')
    return (
      <span
        className={`${base} size-4 border-[3px] border-accent bg-surface ring-4 ring-accent/20`}
      />
    )
  return (
    <span
      className={`${base} size-4 border-2 border-dashed border-muted/60 bg-paper`}
    />
  )
}

function When({ item }: { item: TimelineItem }) {
  if (item.date === TODO) return <Placeholder />
  if (item.date === null)
    return (
      <span className="text-muted">
        <DataText value={item.dateText ?? copy.timeline.notScheduled} />
      </span>
    )
  return <time dateTime={item.date}>{formatDate(item.date)}</time>
}

/**
 * Vertical stepper: done = filled dot, current = ring + "Одоо энд", upcoming = dashed.
 * The next upcoming item with a date gets a countdown.
 */
export default function Timeline({ items }: { items: TimelineItem[] }) {
  const now = today()
  const next = items.findIndex(
    (t) => t.status === 'upcoming' && t.date !== null && isIsoDate(t.date),
  )

  return (
    <ol>
      {items.map((t, i) => {
        const following = items[i + 1]
        const sentence = t.note ? `${t.label}. ${t.note}` : t.label
        return (
          <li
            key={i}
            className="relative grid grid-cols-[1rem_1fr_auto] gap-x-3 pb-7 last:pb-0"
          >
            {following && (
              <span
                aria-hidden="true"
                className={`absolute top-6 bottom-0 left-[7px] border-l-2 ${
                  following.status === 'upcoming'
                    ? 'border-dashed border-muted/50'
                    : 'border-accent'
                }`}
              />
            )}
            <span aria-hidden="true">
              <Dot status={t.status} />
            </span>

            <div className="min-w-0">
              {t.status !== 'current' && (
                <span className="sr-only">
                  {t.status === 'done'
                    ? copy.timeline.done
                    : copy.timeline.upcoming}
                  :{' '}
                </span>
              )}
              <p
                className={
                  t.status === 'upcoming' ? 'text-muted' : 'font-semibold'
                }
              >
                {t.source && !t.note ? (
                  <MarkedText
                    text={t.label}
                    source={t.source}
                    sentence={sentence}
                  />
                ) : (
                  <DataText value={t.label} />
                )}
              </p>
              {t.note && (
                <p className="text-small text-muted">
                  {t.source ? (
                    <MarkedText
                      text={t.note}
                      source={t.source}
                      sentence={sentence}
                    />
                  ) : (
                    <DataText value={t.note} />
                  )}
                </p>
              )}
              {t.status === 'current' && (
                <p className="mt-1.5 inline-flex rounded-full bg-ink px-2.5 py-0.5 text-small font-semibold text-white">
                  {copy.timeline.here}
                </p>
              )}
            </div>

            <div className="pt-0.5 text-right text-small tabular-nums">
              <When item={t} />
              {i === next && t.date && (
                <p className="font-semibold text-accent">
                  {countdown(t.date, now)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
