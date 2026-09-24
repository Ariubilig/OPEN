import { copy } from '../copy'
import type { Source } from '../data/schema'
import { formatDate } from '../lib/format'
import DataText from './DataText'
import Icon from './Icon'

/** "Албан эх сурвалж" / "Мэдээ", optionally with a count ("Албан эх сурвалж 3"). */
export function KindBadge({
  kind,
  count,
}: {
  kind: Source['kind']
  count?: number
}) {
  const n =
    count === undefined ? null : (
      <span className="font-extrabold tabular-nums">{count}</span>
    )
  return kind === 'official' ? (
    <span className="inline-flex h-[22px] items-center gap-[5px] rounded-md bg-accent-soft px-2 text-overline font-bold text-accent-strong">
      <Icon name="document" className="size-[13px]" />
      {copy.source.official}
      {n}
    </span>
  ) : (
    <span className="inline-flex h-[22px] items-center gap-[5px] rounded-md bg-paper px-2 text-overline font-bold text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]">
      <Icon name="news" className="size-[13px]" />
      {copy.source.media}
      {n}
    </span>
  )
}

/** Нийтэлсэн / Шалгасан dates; TODO_VERIFY dates render as placeholders. */
export function SourceDates({
  source,
  variant = 'inline',
}: {
  source: Source
  variant?: 'inline' | 'tiles'
}) {
  const dates: [string, string][] = []
  if (source.publishedAt)
    dates.push([copy.source.published, source.publishedAt])
  dates.push([copy.source.accessed, source.accessedAt])

  if (variant === 'tiles') {
    return (
      <dl className="mt-1 grid grid-cols-2 gap-2">
        {dates.map(([label, date]) => (
          <div key={label} className="rounded-xl bg-paper px-3 py-2.5">
            <dt className="text-overline text-muted">{label}</dt>
            <dd className="mt-0.5 text-[15px] leading-5 font-bold tabular-nums">
              <DataText value={formatDate(date)} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-muted tabular-nums">
      {dates.map(([label, date]) => (
        <div key={label} className="flex gap-1 whitespace-nowrap">
          <dt>{label}:</dt>
          <dd>
            <DataText value={formatDate(date)} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Marker number tag as it appears next to sentences, for lists and the sheet. */
export function SourceNumber({
  n,
  active = false,
}: {
  n: number
  active?: boolean
}) {
  return (
    <span
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-meta font-bold tabular-nums ${
        active ? 'bg-accent text-white' : 'bg-accent-soft text-accent-strong'
      }`}
    >
      {n}
    </span>
  )
}
