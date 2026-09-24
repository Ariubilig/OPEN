import { TODO, type KeyNumber } from '../data/schema'
import { splitNumberUnit } from '../lib/highlight'
import { MarkedText } from './CitedText'
import DataText from './DataText'

/** The value: the number big, its unit ("их наяд төгрөг") on the line below; text stays text. */
function Value({ k }: { k: KeyNumber }) {
  if (k.value === TODO)
    return (
      <p>
        <DataText value={k.value} />
      </p>
    )
  const sentence = `${k.label}: ${k.value}`
  const parts = splitNumberUnit(k.value)
  if (!parts)
    return (
      <p className="text-[19px] leading-[25px] font-extrabold tracking-[-0.015em] sm:text-[22px] sm:leading-7">
        <MarkedText text={k.value} source={k.source} sentence={sentence} />
      </p>
    )
  const [number, unit] = parts
  return (
    <p className="flex flex-col">
      <span className="text-[34px] leading-[38px] font-extrabold tracking-[-0.03em] tabular-nums sm:text-[40px] sm:leading-[44px]">
        {unit ? (
          number
        ) : (
          <MarkedText text={number} source={k.source} sentence={sentence} />
        )}
      </span>
      {unit && (
        <span className="text-[15px] leading-[21px] font-semibold text-ink-2">
          <MarkedText text={unit} source={k.source} sentence={sentence} />
        </span>
      )}
    </p>
  )
}

/**
 * 2×2 grid of number cards: label, big number with its unit and marker, note.
 * Each card is a subgrid of three rows, so labels, numbers and notes line up across a row
 * even when one label wraps onto two lines.
 */
export default function KeyNumbers({ items }: { items: KeyNumber[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((k, i) => (
        <li
          key={i}
          className="row-span-3 grid grid-rows-subgrid gap-y-1 rounded-card border border-line bg-surface p-3.5 sm:p-4"
        >
          <p className="text-meta font-semibold text-muted">
            <DataText value={k.label} />
          </p>
          <Value k={k} />
          <p className="self-end pt-1 text-meta text-muted">
            {k.note && <DataText value={k.note} />}
          </p>
        </li>
      ))}
    </ul>
  )
}
