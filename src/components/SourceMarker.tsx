import { copy } from '../copy'
import { TODO } from '../data/schema'
import { useSourceSheet } from '../lib/sourceSheet'

/**
 * Small numbered pill after a cited sentence (~20px visual, 44px hit area).
 * Renders nothing for a TODO_VERIFY source or an id that is not in story.sources.
 */
export default function SourceMarker({
  source,
  sentence,
}: {
  source: string
  sentence: string
}) {
  const { numbers, open } = useSourceSheet()
  const n = numbers.get(source)
  if (source === TODO || n === undefined) return null
  return (
    <>
      {/* no-break space: the marker never wraps onto a line of its own */}
      {' '}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={copy.source.marker(n)}
        onClick={(e) => open(source, sentence, e.currentTarget)}
        className="relative inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full bg-accent-soft px-1.5 align-middle font-sans text-[12px] leading-none font-semibold text-accent tabular-nums transition-colors before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-[''] hover:bg-accent hover:text-white"
      >
        {n}
      </button>
    </>
  )
}
