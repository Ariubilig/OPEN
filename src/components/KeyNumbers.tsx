import { TODO, type KeyNumber } from '../data/schema'
import { MarkedText } from './CitedText'
import DataText from './DataText'

/** 2×2 grid of number cards: label, big value, note, marker. */
export default function KeyNumbers({ items }: { items: KeyNumber[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((k, i) => (
        <li
          key={i}
          className="flex flex-col rounded-card border border-line bg-surface p-3.5 sm:p-4"
        >
          <p className="text-meta text-muted">
            <DataText value={k.label} />
          </p>
          <p className="mt-1 text-[21px] leading-7 font-extrabold tracking-[-0.02em] tabular-nums sm:text-[26px] sm:leading-8">
            {k.value === TODO ? (
              <DataText value={k.value} />
            ) : (
              <MarkedText
                text={k.value}
                source={k.source}
                sentence={`${k.label}: ${k.value}`}
              />
            )}
          </p>
          {k.note && (
            <p className="mt-1 text-meta text-muted">
              <DataText value={k.note} />
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
