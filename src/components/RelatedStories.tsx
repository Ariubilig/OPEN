import { Link } from 'react-router'
import { getStory } from '../data'
import type { Story } from '../data/schema'
import { TypeLabel } from './Badge'
import DataText from './DataText'
import { StageTracker } from './Stage'

export function relatedStories(story: Story): Story[] {
  return (story.relatedStoryIds ?? [])
    .map((id) => getStory(id))
    .filter((s): s is Story => s !== undefined)
}

/** Small cards linking to related stories: type, title, and where each one is. */
export default function RelatedStories({ stories }: { stories: Story[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {stories.map((s) => (
        <li key={s.id}>
          <Link
            to={`/story/${s.id}`}
            className="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-4 text-ink transition-colors hover:border-ink/40"
          >
            <TypeLabel type={s.type} />
            <span className="text-[16px] leading-[22px] font-bold tracking-[-0.01em]">
              <DataText value={s.title} />
            </span>
            <span className="mt-auto inline-flex items-center gap-2 pt-0.5">
              <StageTracker
                timeline={s.timeline}
                size="sm"
                className="w-14 shrink-0"
              />
              <span className="text-meta font-semibold">{s.stage}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
