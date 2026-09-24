import { Link } from 'react-router'
import { copy } from '../copy'
import { getStory } from '../data'
import type { Story } from '../data/schema'
import { toggleFollow, useFollowing } from '../lib/following'
import { TypeLabel } from './Badge'
import DataText from './DataText'
import { FOCUS_RING, STRETCH } from './FeedCard'
import Icon from './Icon'
import { NextStep, StageTracker } from './Stage'

/** A followed story: where it is and what comes next, with a button to stop following. */
function FollowCard({ story }: { story: Story }) {
  return (
    <article
      className={`group relative flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/40 has-[a:focus-visible]:outline-accent lg:p-5 ${FOCUS_RING}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-3">
          <TypeLabel type={story.type} />
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <span className="text-meta font-semibold">{story.stage}</span>
        </p>
        {/* above the stretched title link */}
        <button
          type="button"
          onClick={() => toggleFollow(story.id)}
          aria-label={copy.following.unfollow(story.title)}
          title={copy.following.followed}
          className="relative z-10 -mt-0.5 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
        >
          <Icon name="bookmark" filled className="size-5" />
        </button>
      </div>
      <h3 className="text-[17px] leading-[23px] font-bold tracking-[-0.01em] text-pretty lg:text-[19px] lg:leading-[25px]">
        <Link to={`/story/${story.id}`} className={`text-ink ${STRETCH}`}>
          <DataText value={story.title} />
        </Link>
      </h3>
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3.5">
        <StageTracker timeline={story.timeline} />
        <NextStep timeline={story.timeline} />
      </div>
    </article>
  )
}

/** "Дагаж буй": the stories this reader follows (kept in this browser), newest first. */
export default function Following() {
  const followed = useFollowing()
    .map((id) => getStory(id))
    .filter((s): s is Story => s !== undefined)
  if (followed.length === 0) return null
  return (
    <section aria-labelledby="following-title" className="mt-9 lg:mt-16">
      <div className="flex items-baseline gap-2.5">
        <h2
          id="following-title"
          className="text-[22px] leading-7 lg:text-[28px] lg:leading-[34px]"
        >
          {copy.following.title}
        </h2>
        <span className="text-small text-muted tabular-nums">
          {copy.feed.count(followed.length)}
        </span>
      </div>
      <p className="mt-1 text-small text-ink-2">{copy.following.hint}</p>
      <ul className="mt-3.5 grid gap-3 md:grid-cols-2 lg:mt-[18px] lg:grid-cols-3 lg:gap-5">
        {followed.map((s) => (
          <li key={s.id}>
            <FollowCard story={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}
