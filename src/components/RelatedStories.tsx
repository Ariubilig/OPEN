import { Link } from 'react-router'
import { getStory } from '../data'
import type { Story } from '../data/schema'
import { TypeLabel } from './Badge'
import DataText from './DataText'

export function relatedStories(story: Story): Story[] {
  return (story.relatedStoryIds ?? [])
    .map((id) => getStory(id))
    .filter((s): s is Story => s !== undefined)
}

/** Small cards linking to related stories. */
export default function RelatedStories({ stories }: { stories: Story[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {stories.map((s) => (
        <li key={s.id}>
          <Link
            to={`/story/${s.id}`}
            className="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent/50"
          >
            <span>
              <TypeLabel type={s.type} />
            </span>
            <span className="font-serif text-[17px] leading-[24px] font-bold text-ink">
              <DataText value={s.title} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
