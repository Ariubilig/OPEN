import { copy } from '../copy'
import type { Source } from '../data/schema'
import { formatDate } from '../lib/format'
import DataText from './DataText'

/** "Албан эх сурвалж" / "Мэдээ" */
export function KindBadge({ kind }: { kind: Source['kind'] }) {
  return kind === 'official' ? (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-small font-semibold text-accent">
      {copy.source.official}
    </span>
  ) : (
    <span className="rounded-full bg-paper px-2 py-0.5 text-small font-semibold text-muted ring-1 ring-line ring-inset">
      {copy.source.media}
    </span>
  )
}

/** Нийтэлсэн / Шалгасан dates; TODO_VERIFY dates render as placeholders. */
export function SourceDates({ source }: { source: Source }) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-small text-muted tabular-nums">
      {source.publishedAt && (
        <div className="flex gap-1">
          <dt>{copy.source.published}:</dt>
          <dd>
            <DataText value={formatDate(source.publishedAt)} />
          </dd>
        </div>
      )}
      <div className="flex gap-1">
        <dt>{copy.source.accessed}:</dt>
        <dd>
          <DataText value={formatDate(source.accessedAt)} />
        </dd>
      </div>
    </dl>
  )
}

/** Marker number pill as it appears next to sentences, for lists and the sheet. */
export function SourceNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-small font-semibold text-accent tabular-nums">
      {n}
    </span>
  )
}
