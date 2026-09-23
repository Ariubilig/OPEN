import { useId } from 'react'
import { copy } from '../copy'
import type { Position } from '../data/schema'
import CitedText from './CitedText'
import DataText from './DataText'

/** One card per actor. Identical styling for every actor: no side is highlighted. */
export default function Positions({ items }: { items: Position[] }) {
  const titleId = useId()
  return (
    <div className="mt-8" role="group" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-[19px] leading-[26px]">
        {copy.story.sections.positions}
      </h3>
      <p className="mt-1 text-small text-muted">{copy.story.positionsNote}</p>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {items.map((p, i) => (
          <li
            key={i}
            className="rounded-card border border-line bg-surface p-4"
          >
            <p className="text-[15px] leading-5 font-bold">
              <DataText value={p.actor} />
            </p>
            <p className="mt-1.5 text-[16px] leading-[25px]">
              <CitedText cited={p} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
