import { copy } from '../copy'
import type { Story } from '../data/schema'
import { useSourceSheet } from '../lib/sourceSheet'
import DataText from './DataText'
import ExternalLink from './ExternalLink'
import { KindBadge, SourceDates, SourceNumber } from './SourceMeta'

/** Principle line, then every source in marker order. */
export default function SourcesBlock({ story }: { story: Story }) {
  const { numbers } = useSourceSheet()
  const ordered = [...story.sources].sort(
    (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
  )
  return (
    <>
      <p className="text-small font-semibold">{copy.principle}</p>
      <ol className="mt-4 space-y-3">
        {ordered.map((s) => (
          <li
            key={s.id}
            className="flex gap-3 rounded-card border border-line bg-surface p-4"
          >
            <SourceNumber n={numbers.get(s.id) ?? 0} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="font-semibold break-words">
                <DataText value={s.title} />
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
                <DataText value={s.publisher} />
                <KindBadge kind={s.kind} />
              </p>
              <SourceDates source={s} />
              {s.note && (
                <p className="text-small">
                  <DataText value={s.note} />
                </p>
              )}
              <ExternalLink href={s.url} className="text-small">
                {copy.source.open}
              </ExternalLink>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
