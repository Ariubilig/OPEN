import { copy } from '../copy'
import { isIsoDate, type TimelineItem } from '../data/schema'
import { downloadFile } from '../lib/download'
import { formatDate, today } from '../lib/format'
import { icsCalendar, stepEvent } from '../lib/ics'
import { countdown, nextDatedIndex } from '../lib/timeline'
import { MarkedText } from './CitedText'
import DataText from './DataText'
import Icon from './Icon'
import { StepDate, StepLabel } from './Stage'

/** "Календарьт нэмэх": the step as an all-day event in a calendar file. */
function CalendarButton({
  story,
  step,
  index,
}: {
  story: { id: string; title: string }
  step: TimelineItem & { date: string }
  index: number
}) {
  return (
    <button
      type="button"
      onClick={() =>
        downloadFile(
          `${story.id}-${step.date}.ics`,
          icsCalendar(
            [stepEvent(story, step, index, window.location.origin)],
            new Date(),
          ),
          'text/calendar;charset=utf-8',
        )
      }
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-small font-semibold text-accent hover:text-accent-strong"
    >
      <Icon name="calendar" className="size-4" />
      {copy.calendar.add}
      <span className="sr-only">
        : <DataText value={step.label} />, {formatDate(step.date)} (
        {copy.calendar.file})
      </span>
    </button>
  )
}

function Dot({ status }: { status: TimelineItem['status'] }) {
  const base = 'relative mt-0.5 block size-3.5 rounded-full'
  if (status === 'done') return <span className={`${base} bg-ink`} />
  if (status === 'current')
    return (
      <span
        className={`${base} bg-highlight shadow-[inset_0_0_0_2.5px_var(--ink)]`}
      />
    )
  return (
    <span
      className={`${base} border-2 border-dashed border-on-ink-3 bg-paper`}
    />
  )
}

/**
 * Vertical stepper, date first: done = ink dot, current = highlighter + "Одоо энд",
 * upcoming = dashed. The next upcoming step with a date gets a countdown.
 */
export default function Timeline({
  items,
  story,
}: {
  items: TimelineItem[]
  /** the story the steps belong to: future dated steps get "Календарьт нэмэх" */
  story?: { id: string; title: string }
}) {
  const now = today()
  const next = nextDatedIndex(items)

  return (
    <ol>
      {items.map((t, i) => {
        const following = items[i + 1]
        const sentence = t.note ? `${t.label}. ${t.note}` : t.label
        return (
          <li
            key={i}
            className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-x-3.5 pb-6 last:pb-0"
          >
            {following && (
              <span
                aria-hidden="true"
                className={`absolute top-[22px] -bottom-0.5 left-1.5 border-l-2 ${
                  following.status === 'upcoming'
                    ? 'border-dashed border-line-strong'
                    : 'border-ink'
                }`}
              />
            )}
            <span aria-hidden="true">
              <Dot status={t.status} />
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-meta font-bold text-muted tabular-nums">
                <StepDate item={t} />
                {i === next && t.date && (
                  <span className="text-accent">
                    {' · '}
                    {countdown(t.date, now)}
                  </span>
                )}
              </p>
              <p
                className={`text-[16px] leading-[23px] ${
                  t.status === 'upcoming'
                    ? 'font-medium text-ink-2'
                    : 'font-semibold'
                }`}
              >
                {t.status !== 'current' && (
                  <span className="sr-only">
                    {t.status === 'done'
                      ? copy.timeline.done
                      : copy.timeline.upcoming}
                    :{' '}
                  </span>
                )}
                {/* with a note, the marker goes after the note instead */}
                <StepLabel item={t} cite={!t.note} />
              </p>
              {t.note && (
                <p className="text-small leading-[21px] text-muted">
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
              {story &&
                t.status === 'upcoming' &&
                t.date !== null &&
                isIsoDate(t.date) &&
                t.date >= now && (
                  <CalendarButton
                    story={story}
                    step={{ ...t, date: t.date }}
                    index={i}
                  />
                )}
              {t.status === 'current' && (
                <p className="mt-1 inline-flex h-6 items-center self-start rounded-full bg-highlight px-2.5 text-overline font-extrabold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]">
                  {copy.timeline.here}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
