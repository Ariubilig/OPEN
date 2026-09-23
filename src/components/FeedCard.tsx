import { Link } from 'react-router'
import { copy } from '../copy'
import type { Story } from '../data/schema'
import { formatDate } from '../lib/format'
import { TypeLabel } from './Badge'
import DataText from './DataText'
import Icon from './Icon'
import { NextStep, StageTracker } from './Stage'

// Every card is one link: the title link is stretched over the whole card.
const STRETCH =
  "after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:outline-none"
const FOCUS_RING =
  'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2'

function TypeAndStage({
  story,
  tone,
}: {
  story: Story
  tone: 'light' | 'dark'
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <TypeLabel type={story.type} tone={tone} />
      <span
        aria-hidden="true"
        className={tone === 'dark' ? 'text-on-ink-3' : 'text-muted'}
      >
        ·
      </span>
      <span
        className={`text-meta font-semibold ${tone === 'dark' ? 'text-on-ink-2' : 'text-ink'}`}
      >
        {story.stage}
      </span>
    </div>
  )
}

function Meta({ story, tone }: { story: Story; tone: 'light' | 'dark' }) {
  return (
    <p
      className={`text-meta tabular-nums ${tone === 'dark' ? 'text-on-ink-3' : 'text-muted'}`}
    >
      <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time>
      <span aria-hidden="true"> · </span>
      {copy.feed.sources(story.sources.length)}
    </p>
  )
}

function ArrowDot({ tone }: { tone: 'light' | 'dark' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 ${
        tone === 'dark' ? 'bg-highlight text-ink' : 'bg-ink text-white'
      }`}
    >
      <Icon name="arrowRight" className="size-5" />
    </span>
  )
}

/** The first featured story: an ink card with the key amount of its title highlighted. */
export function LeadCard({ story }: { story: Story }) {
  return (
    <article
      className={`on-ink group relative flex flex-col gap-3.5 rounded-card bg-ink p-5 text-on-ink has-[a:focus-visible]:outline-highlight lg:gap-5 lg:rounded-card-lg lg:p-8 ${FOCUS_RING}`}
    >
      <TypeAndStage story={story} tone="dark" />
      <h3 className="text-[25px] leading-[30px] tracking-[-0.03em] lg:text-[40px] lg:leading-[46px]">
        <Link to={`/story/${story.id}`} className={`text-on-ink ${STRETCH}`}>
          <DataText value={story.title} highlight="mark" />
        </Link>
      </h3>
      <p className="text-[15px] leading-[23px] text-on-ink-2 lg:max-w-[640px] lg:text-body">
        <DataText value={story.summary.text} />
      </p>
      <div className="mt-0.5 flex flex-col gap-3 border-t border-ink-line pt-4 lg:mt-2">
        <StageTracker timeline={story.timeline} tone="dark" />
        <NextStep
          timeline={story.timeline}
          tone="dark"
          labelClassName="text-[15px] leading-[21px] lg:text-[16px] lg:leading-[22px]"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Meta story={story} tone="dark" />
        <ArrowDot tone="dark" />
      </div>
    </article>
  )
}

/** Other featured stories: a white card with the same stage block. */
export function FeatureCard({ story }: { story: Story }) {
  return (
    <article
      className={`group relative flex flex-col gap-3.5 rounded-card border border-line bg-surface p-5 transition-colors hover:border-ink/40 has-[a:focus-visible]:outline-accent lg:gap-[18px] lg:rounded-card-lg lg:p-8 ${FOCUS_RING}`}
    >
      <TypeAndStage story={story} tone="light" />
      <h3 className="text-[22px] leading-7 tracking-[-0.025em] lg:text-[28px] lg:leading-[34px]">
        <Link to={`/story/${story.id}`} className={`text-ink ${STRETCH}`}>
          <DataText value={story.title} highlight="mark" />
        </Link>
      </h3>
      <p className="line-clamp-3 text-[15px] leading-[23px] text-muted lg:text-[16px] lg:leading-[25px]">
        <DataText value={story.summary.text} />
      </p>
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <StageTracker timeline={story.timeline} />
        <NextStep
          timeline={story.timeline}
          labelClassName="text-[15px] leading-[21px] lg:text-[16px] lg:leading-[22px]"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Meta story={story} tone="light" />
        <ArrowDot tone="light" />
      </div>
    </article>
  )
}

/** One story in the list: type and date, title, two lines of summary, stage. */
export default function FeedCard({ story }: { story: Story }) {
  return (
    <article
      className={`group relative flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4 transition-colors hover:border-ink/40 has-[a:focus-visible]:outline-accent lg:p-6 ${FOCUS_RING}`}
    >
      <div className="flex items-center justify-between gap-3">
        <TypeLabel type={story.type} />
        <time
          dateTime={story.publishedAt}
          className="text-meta text-muted tabular-nums"
        >
          {formatDate(story.publishedAt)}
        </time>
      </div>
      <h3 className="text-[18px] leading-6 font-bold tracking-[-0.015em] text-pretty lg:text-[21px] lg:leading-7">
        <Link to={`/story/${story.id}`} className={`text-ink ${STRETCH}`}>
          <DataText value={story.title} />
        </Link>
      </h3>
      <p className="line-clamp-2 text-[15px] leading-[22px] text-muted">
        <DataText value={story.summary.text} />
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-1.5">
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <StageTracker
            timeline={story.timeline}
            size="sm"
            className="w-14 shrink-0"
          />
          <span className="text-meta font-semibold">{story.stage}</span>
        </span>
        <span className="shrink-0 text-meta text-muted">
          {copy.feed.sources(story.sources.length)}
        </span>
      </div>
    </article>
  )
}
