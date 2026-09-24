import { Link } from 'react-router'
import { copy } from '../copy'
import type { Story } from '../data/schema'
import { daysBetween, formatDate, today } from '../lib/format'
import { countdown } from '../lib/timeline'
import {
  ago,
  recentEvents,
  unscheduledNext,
  upcomingByDate,
  type TrackerEvent,
} from '../lib/tracker'
import DataText from './DataText'

/** Big day count on the highlighter: "99 / хоног". */
function DaysLeft({ date, now }: { date: string; now: string }) {
  const days = daysBetween(now, date)
  return (
    <span
      aria-hidden="true"
      className="flex h-[68px] w-[72px] shrink-0 flex-col items-center justify-center rounded-2xl bg-highlight text-ink"
    >
      {days === 0 ? (
        <span className="text-small font-extrabold">{copy.timeline.today}</span>
      ) : (
        <>
          <span className="text-[26px] leading-7 font-extrabold tracking-[-0.03em] tabular-nums">
            {days}
          </span>
          <span className="text-overline font-bold">{copy.tracker.days}</span>
        </>
      )}
    </span>
  )
}

/** One step, linking to its story: the step in bold, the story title under it. */
function EventLink({
  event,
  tone,
}: {
  event: Pick<TrackerEvent, 'story' | 'item'>
  tone: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  const { dateText } = event.item
  return (
    <Link
      to={`/story/${event.story.id}`}
      className="group flex min-h-11 flex-col gap-0.5 rounded-lg"
    >
      <span
        className={`text-[15px] leading-[21px] font-semibold transition-colors ${
          dark
            ? 'text-on-ink group-hover:text-highlight'
            : 'text-ink group-hover:text-accent-strong'
        }`}
      >
        <DataText value={event.item.label} />
        {/* a rough date for an unscheduled step, e.g. "2028 он" */}
        {event.item.date === null && dateText && (
          <span
            className={`font-normal ${dark ? 'text-on-ink-2' : 'text-ink-2'}`}
          >
            {' · '}
            <DataText value={dateText} />
          </span>
        )}
      </span>
      <span
        className={`line-clamp-2 text-meta ${dark ? 'text-on-ink-3' : 'text-ink-2'}`}
      >
        <DataText value={event.story.title} />
      </span>
    </Link>
  )
}

/**
 * "Шийдвэрүүд хаана явж байна?": the next dated steps of every document with a day count,
 * and the latest step each document took. Every date comes from the story timelines.
 */
export default function Tracker({ stories }: { stories: Story[] }) {
  const now = today()
  const upcoming = upcomingByDate(stories, now)
  const unscheduled = unscheduledNext(stories)
  const recent = recentEvents(stories, now)
  if (upcoming.length === 0 && recent.length === 0) return null

  return (
    <section aria-labelledby="tracker-title" className="mt-10 lg:mt-[72px]">
      <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <h2
          id="tracker-title"
          className="text-[22px] leading-7 lg:text-[28px] lg:leading-[34px]"
        >
          {copy.tracker.title}
        </h2>
        <p className="text-small text-ink-2 lg:pb-1">{copy.tracker.hint}</p>
      </div>

      <div className="mt-3.5 grid gap-3 lg:mt-[18px] lg:grid-cols-[7fr_5fr] lg:gap-6">
        {upcoming.length > 0 && (
          <div className="on-ink rounded-card bg-ink p-5 text-on-ink lg:rounded-card-lg lg:p-8">
            <h3 className="text-[18px] leading-6 font-extrabold">
              {copy.tracker.upcoming}
            </h3>
            <ol className="mt-4 flex flex-col">
              {upcoming.map((group) => (
                <li
                  key={group.date}
                  className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 border-t border-ink-line py-4 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <DaysLeft date={group.date} now={now} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-small font-bold tabular-nums">
                      <time dateTime={group.date}>
                        {formatDate(group.date)}
                      </time>
                      <span className="text-on-ink-3">
                        {' '}
                        · {countdown(group.date, now)}
                      </span>
                    </p>
                    <ul className="flex flex-col gap-2.5">
                      {group.events.map((e) => (
                        <li key={`${e.story.id} ${e.item.label}`}>
                          <EventLink event={e} tone="dark" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
            {/* wider screens: the next steps that have no date yet (phones keep the list short) */}
            {unscheduled.length > 0 && (
              <div className="mt-5 hidden border-t border-ink-line pt-4 md:block">
                <h4 className="eyebrow text-on-ink-3">
                  {copy.tracker.unscheduled}
                </h4>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {unscheduled.map((e) => (
                    <li
                      key={e.story.id}
                      className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[3px] size-3.5 rounded-full border-2 border-dashed border-on-ink-3"
                      />
                      <EventLink event={e} tone="dark" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {recent.length > 0 && (
          <div className="rounded-card border border-line bg-surface p-5 lg:rounded-card-lg lg:p-8">
            <h3 className="text-[18px] leading-6 font-extrabold">
              {copy.tracker.recent}
            </h3>
            <ol className="mt-4 flex flex-col">
              {recent.map((e, i) => {
                const when = ago(e.date, now)
                const date = formatDate(e.date)
                return (
                  <li
                    key={e.story.id}
                    className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0"
                  >
                    {/* line to the next event */}
                    {i < recent.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-[22px] bottom-0.5 left-1.5 w-0.5 rounded-full bg-line-strong"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={`relative mt-[3px] size-3.5 rounded-full ${
                        e.item.status === 'current'
                          ? 'bg-highlight shadow-[inset_0_0_0_2.5px_var(--ink)]'
                          : 'bg-ink'
                      }`}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-meta text-muted tabular-nums">
                        <time dateTime={e.date}>
                          {when === date ? date : `${when} · ${date}`}
                        </time>
                      </p>
                      <EventLink event={e} tone="light" />
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
