import { useState } from 'react'
import { copy } from '../copy'
import { GROUPS, type Affect, type Group } from '../data/schema'
import Chip from './Chip'
import CitedText from './CitedText'

/** Group filter chips (Бүгд + groups present), then the items grouped under each group. */
export default function AffectsBlock({ items }: { items: Affect[] }) {
  const groups = GROUPS.filter((g) => items.some((a) => a.group === g))
  const [group, setGroup] = useState<Group | null>(null)
  const shown = group ? items.filter((a) => a.group === group) : items
  // groups in the order they first appear in the data
  const order = [...new Set(shown.map((a) => a.group))]

  return (
    <>
      {groups.length > 1 && (
        <div
          role="group"
          aria-label={copy.story.sections.affects}
          className="-mx-4 mb-3.5 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <Chip selected={group === null} onClick={() => setGroup(null)}>
            {copy.story.allGroups}
          </Chip>
          {groups.map((g) => (
            <Chip key={g} selected={group === g} onClick={() => setGroup(g)}>
              {g}
            </Chip>
          ))}
        </div>
      )}
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {order.map((g) => (
          <li key={g} className="flex flex-col gap-2 p-4">
            <h3 className="text-[15px] leading-5 font-bold tracking-normal">
              {g}
            </h3>
            {shown
              .filter((a) => a.group === g)
              .map((a, i) => (
                <p key={i} className="text-[16px] leading-[25px]">
                  <CitedText cited={a} />
                </p>
              ))}
          </li>
        ))}
      </ul>
    </>
  )
}
