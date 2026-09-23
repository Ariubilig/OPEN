import { TODO } from '../data/schema'
import DataText from './DataText'
import SourceMarker from './SourceMarker'

/**
 * Data text followed by its source marker. The last word and the marker are kept on one line
 * (browsers may break before an inline button even after a no-break space).
 */
export function MarkedText({
  text,
  source,
  sentence = text,
}: {
  text: string
  source: string
  sentence?: string
}) {
  const cut = text.lastIndexOf(' ') + 1
  return (
    <>
      <DataText value={text.slice(0, cut)} />
      <span className="whitespace-nowrap">
        <DataText value={text.slice(cut)} />
        <SourceMarker source={source} sentence={sentence} />
      </span>
    </>
  )
}

/** A content sentence with its source marker. TODO_VERIFY text gets a placeholder and no marker. */
export default function CitedText({
  cited,
}: {
  cited: { text: string; source: string }
}) {
  if (cited.text === TODO) return <DataText value={cited.text} />
  return <MarkedText text={cited.text} source={cited.source} />
}
