import { useId, useState } from 'react'
import { copy } from '../copy'
import { GROUPS, type Affect, type Group } from '../data/schema'
import Chip from './Chip'
import CitedText from './CitedText'

/** Group filter chips (Бүгд + groups present), then one row per affect. */
export default function AffectsBlock({ items }: { items: Affect[] }) {
  const groups = GROUPS.filter((g) => items.some((a) => a.group === g))
  const [group, setGroup] = useState<Group | null>(null)
  const listId = useId()
  const shown = group ? items.filter((a) => a.group === group) : items

  return (
    <>
      {groups.length > 1 && (
        <div
          role="group"
          aria-label={copy.story.sections.affects}
          className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
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
      <ul
        id={listId}
        className="divide-y divide-line rounded-card border border-line bg-surface"
      >
        {shown.map((a, i) => (
          <li key={`${a.group}-${i}`} className="p-4">
            <p className="text-small font-semibold text-muted">{a.group}</p>
            <p className="mt-0.5">
              <CitedText cited={a} />
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
