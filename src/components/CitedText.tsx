import { TODO } from '../data/schema'
import { splitFirstAmount } from '../lib/highlight'
import DataText, { type Highlight } from './DataText'
import SourceMarker from './SourceMarker'

/**
 * Data text followed by its source marker. The last word and the marker are kept on one line
 * (browsers may break before an inline button even after a no-break space).
 * `highlight` marks the first amount of the whole sentence.
 */
export function MarkedText({
  text,
  source,
  sentence = text,
  highlight,
}: {
  text: string
  source: string
  sentence?: string
  highlight?: Highlight
}) {
  const cut = text.lastIndexOf(' ') + 1
  const head = text.slice(0, cut)
  const last = text.slice(cut)
  const headHasAmount =
    highlight !== undefined && splitFirstAmount(head) !== null
  return (
    <>
      <DataText value={head} highlight={highlight} />
      <span className="whitespace-nowrap">
        <DataText
          value={last}
          highlight={headHasAmount ? undefined : highlight}
        />
        <SourceMarker source={source} sentence={sentence} />
      </span>
    </>
  )
}

/** A content sentence with its source marker. TODO_VERIFY text gets a placeholder and no marker. */
export default function CitedText({
  cited,
  highlight,
}: {
  cited: { text: string; source: string }
  highlight?: Highlight
}) {
  if (cited.text === TODO) return <DataText value={cited.text} />
  return (
    <MarkedText text={cited.text} source={cited.source} highlight={highlight} />
  )
}
