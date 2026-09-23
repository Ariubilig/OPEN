import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { copy } from '../copy'
import type { Story } from '../data/schema'
import { formatDate } from '../lib/format'
import { BadgeRow } from './Badge'
import DataText from './DataText'

type Props = { story: Story; size?: 'large' | 'normal' }

/** A meta item with its leading separator, kept together so a wrapped line never ends in "·". */
function MetaItem({ children }: { children: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden="true" className="mr-2">
        ·
      </span>
      {children}
    </span>
  )
}

/**
 * One story in the feed. The title link is stretched over the whole card (one link per card);
 * the badges sit above it so their hints stay tappable.
 */
export default function FeedCard({ story, size = 'normal' }: Props) {
  const large = size === 'large'
  return (
    <article
      className={`group relative flex flex-col gap-2 rounded-card border border-line bg-surface transition-colors hover:border-accent/50 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent ${
        large ? 'p-5 md:p-6' : 'p-4'
      }`}
    >
      <div className="-my-1.5">
        <BadgeRow type={story.type} stage={story.stage} />
      </div>
      <h3
        className={
          large
            ? 'text-h2 md:text-[26px] md:leading-[34px]'
            : 'text-[19px] leading-[26px]'
        }
      >
        <Link
          to={`/story/${story.id}`}
          className="text-ink after:absolute after:inset-0 after:rounded-card after:content-[''] group-hover:text-accent focus-visible:outline-none"
        >
          <DataText value={story.title} />
        </Link>
      </h3>
      <p className={`text-muted ${large ? 'line-clamp-4' : 'line-clamp-3'}`}>
        <DataText value={story.summary.text} />
      </p>
      <p className="mt-auto flex flex-wrap items-center gap-x-2 pt-1 text-small text-muted tabular-nums">
        <time dateTime={story.publishedAt}>
          {formatDate(story.publishedAt)}
        </time>
        <MetaItem>{copy.feed.sources(story.sources.length)}</MetaItem>
        {story.featured && (
          <span className="rounded-full bg-accent-soft px-2 font-semibold whitespace-nowrap text-accent">
            {copy.feed.fullStory}
          </span>
        )}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {story.topics.slice(0, 3).map((topic) => (
          <li
            key={topic}
            className="rounded-full bg-paper px-2 py-0.5 text-small text-muted ring-1 ring-line ring-inset"
          >
            {topic}
          </li>
        ))}
      </ul>
    </article>
  )
}
