import type { Cited } from '../data/schema'
import CitedText from './CitedText'

/** Plain-language points; the first amount in each gets the underline highlighter. */
export default function MeaningBlock({ items }: { items: Cited[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((m, i) => (
        <li
          key={i}
          className="grid grid-cols-[8px_minmax(0,1fr)] gap-x-3.5 lg:text-[18px] lg:leading-[29px]"
        >
          <span
            aria-hidden="true"
            className="mt-2.5 size-2 rounded-[2px] bg-ink lg:mt-[11px]"
          />
          <span>
            <CitedText cited={m} highlight="underline" />
          </span>
        </li>
      ))}
    </ul>
  )
}
