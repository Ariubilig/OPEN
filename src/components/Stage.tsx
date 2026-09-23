import { copy } from '../copy'
import { isIsoDate, TODO, type TimelineItem } from '../data/schema'
import { formatDate, today } from '../lib/format'
import { countdown } from '../lib/timeline'
import { MarkedText } from './CitedText'
import DataText from './DataText'
import Placeholder from './Placeholder'

type Tone = 'light' | 'dark'

const SEGMENT: Record<Tone, Record<TimelineItem['status'], string>> = {
  light: {
    done: 'bg-ink',
    current: 'bg-highlight shadow-[inset_0_0_0_1.5px_var(--ink)]',
    upcoming: 'bg-empty',
  },
  dark: {
    done: 'bg-on-ink',
    current: 'bg-highlight',
    upcoming: 'bg-white/16',
  },
}

/**
 * One segment per timeline step: done = ink, current = highlighter with an ink ring,
 * upcoming = empty. Decorative: the stage name next to it says the same in words.
 */
export function StageTracker({
  timeline,
  tone = 'light',
  size = 'md',
  className = '',
}: {
  timeline: TimelineItem[]
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const height = size === 'lg' ? 'h-2' : size === 'sm' ? 'h-[5px]' : 'h-1.5'
  return (
    <span
      aria-hidden="true"
      className={`flex ${size === 'sm' ? 'gap-[3px]' : 'gap-1'} ${className}`}
    >
      {timeline.map((t, i) => (
        <span
          key={i}
          className={`${height} flex-1 rounded-full ${SEGMENT[tone][t.status]}`}
        />
      ))}
    </span>
  )
}

/** The date of a step: formatted date, "Товлогдоогүй"/dateText, or a placeholder. */
export function StepDate({ item }: { item: TimelineItem }) {
  if (item.date === TODO) return <Placeholder />
  if (item.date === null)
    return <DataText value={item.dateText ?? copy.timeline.notScheduled} />
  return <time dateTime={item.date}>{formatDate(item.date)}</time>
}

/** A step label, with its source marker when `cite` is on and the step has a source. */
export function StepLabel({
  item,
  cite,
}: {
  item: TimelineItem
  cite: boolean
}) {
  if (cite && item.source) {
    const sentence = item.note ? `${item.label}. ${item.note}` : item.label
    return (
      <MarkedText text={item.label} source={item.source} sentence={sentence} />
    )
  }
  return <DataText value={item.label} />
}

/**
 * "ДАРААГИЙН ШАТ", the next upcoming step, then its date and countdown.
 * `cite` adds source markers (story page only — feed cards are links and carry none).
 */
export function NextStep({
  timeline,
  tone = 'light',
  cite = false,
  labelClassName = 'text-[15px] leading-[21px]',
}: {
  timeline: TimelineItem[]
  tone?: Tone
  cite?: boolean
  labelClassName?: string
}) {
  const next = timeline.find((t) => t.status === 'upcoming')
  if (!next) return null
  const dated = next.date !== null && next.date !== TODO && isIsoDate(next.date)
  const quiet = tone === 'dark' ? 'text-on-ink-3' : 'text-muted'
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={`eyebrow ${quiet}`}>{copy.timeline.next}</p>
      <p
        className={`font-medium ${tone === 'dark' ? 'text-on-ink' : 'text-ink'} ${labelClassName}`}
      >
        <StepLabel item={next} cite={cite} />
      </p>
      <p
        className={`flex flex-wrap items-baseline gap-x-1.5 text-meta tabular-nums ${quiet}`}
      >
        <StepDate item={next} />
        {dated && (
          <>
            <span aria-hidden="true">·</span>
            <span
              className={`font-bold ${tone === 'dark' ? 'text-highlight' : 'text-accent'}`}
            >
              {countdown(next.date!, today())}
            </span>
          </>
        )}
      </p>
    </div>
  )
}
