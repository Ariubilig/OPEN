import { Fragment } from 'react'
import { TODO } from '../data/schema'
import { splitFirstAmount } from '../lib/highlight'
import Placeholder from './Placeholder'

export type Highlight = 'mark' | 'underline'

/** Text with every TODO_VERIFY — the whole value or a token inside it — as a visible placeholder. */
function PlainText({ value }: { value: string }) {
  if (!value.includes(TODO)) return <>{value}</>
  const parts = value.split(TODO)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Placeholder />}
        </Fragment>
      ))}
    </>
  )
}

/**
 * Renders any string that comes from data. With `highlight`, the first amount in it
 * (₮, %, тэрбум, их наяд) gets the highlighter: a full stroke ("mark") or an underline.
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
  return (
    <>
      <PlainText value={before} />
      <mark className={highlight === 'mark' ? 'hl-mark' : 'hl-under'}>
        {amount}
      </mark>
      <PlainText value={after} />
    </>
  )
}
