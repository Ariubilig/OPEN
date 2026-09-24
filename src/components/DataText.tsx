import { Fragment } from 'react'
import { TODO } from '../data/schema'
import { splitFirstAmount } from '../lib/highlight'
import { glueSegments, leadingSuffix } from '../lib/typography'
import Placeholder from './Placeholder'

export type Highlight = 'mark' | 'underline'

/** Dashed tokens ("792,000₮-өөс", "УИХ-ын", "15–24") never break at the dash. */
function Glued({ value }: { value: string }) {
  return (
    <>
      {glueSegments(value).map((s, i) =>
        s.glued ? (
          <span key={i} className="whitespace-nowrap">
            {s.text}
          </span>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

/** Text with every TODO_VERIFY — the whole value or a token inside it — as a visible placeholder. */
function PlainText({ value }: { value: string }) {
  if (!value.includes(TODO)) return <Glued value={value} />
  const parts = value.split(TODO)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          <Glued value={part} />
          {i < parts.length - 1 && <Placeholder />}
        </Fragment>
      ))}
    </>
  )
}

/**
 * Renders any string that comes from data. With `highlight`, the first amount in it
 * (₮, %, тэрбум, их наяд) gets the highlighter: a full stroke ("mark") or an underline.
 * The amount and a case suffix after it ("792,000₮-өөс") stay on one line.
 */
export default function DataText({
  value,
  highlight,
}: {
  value: string
  highlight?: Highlight
}) {
  const parts = highlight ? splitFirstAmount(value) : null
  if (!parts) return <PlainText value={value} />
  const [before, amount, after] = parts
  const suffix = leadingSuffix(after)
  return (
    <>
      <PlainText value={before} />
      <span className="whitespace-nowrap">
        <mark className={highlight === 'mark' ? 'hl-mark' : 'hl-under'}>
          {amount}
        </mark>
        {suffix}
      </span>
      <PlainText value={after.slice(suffix.length)} />
    </>
  )
}
