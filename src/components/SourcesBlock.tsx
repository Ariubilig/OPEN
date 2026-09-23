import { copy } from '../copy'
import { TODO, type Story } from '../data/schema'
import { useSourceSheet } from '../lib/sourceSheet'
import DataText from './DataText'
import Icon from './Icon'
import Placeholder from './Placeholder'
import { KindBadge, SourceDates, SourceNumber } from './SourceMeta'

/** Principle line, then every source in marker order; each row opens its source in a new tab. */
export default function SourcesBlock({ story }: { story: Story }) {
  const { numbers } = useSourceSheet()
  const ordered = [...story.sources].sort(
    (a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0),
  )
  const official = story.sources.filter((s) => s.kind === 'official').length
  const media = story.sources.length - official
  return (
    <>
      <p className="flex items-start gap-2.5 text-[15px] leading-[22px] font-semibold">
        <Icon name="checkCircle" className="size-5 text-accent" />
        {copy.principle}
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        {official > 0 && <KindBadge kind="official" count={official} />}
        {media > 0 && <KindBadge kind="media" count={media} />}
      </p>
      <ol className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
        {ordered.map((s) => (
          <li
            key={s.id}
            className="group relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 p-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-accent"
          >
            <SourceNumber n={numbers.get(s.id) ?? 0} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-[16px] leading-[22px] font-semibold break-words">
                {s.url === TODO ? (
                  <>
                    <DataText value={s.title} /> <Placeholder />
                  </>
                ) : (
                  // the whole row is the link (a large tap target)
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink group-hover:text-accent-strong after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                  >
                    <DataText value={s.title} />
                    <Icon
                      name="externalLink"
                      className="ml-1.5 inline size-[15px] align-[-0.125em] text-accent"
                    />
                    <span className="sr-only"> ({copy.a11y.newTab})</span>
                  </a>
                )}
              </p>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-meta text-muted">
                <DataText value={s.publisher} />
                <KindBadge kind={s.kind} />
              </p>
              <SourceDates source={s} />
              {s.note && (
                <p className="text-meta leading-[19px] text-ink-2">
                  <DataText value={s.note} />
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}
