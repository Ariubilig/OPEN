import { useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import FeedCard, { FeatureCard, LeadCard } from '../components/FeedCard'
import { TopicChips, TypeSelect } from '../components/FilterBar'
import Icon from '../components/Icon'
import SentenceLines from '../components/SentenceLines'
import { copy } from '../copy'
import { stories } from '../data'
import { DOC_TYPES, TOPICS, type DocType, type Topic } from '../data/schema'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// Filter options: only the types and topics present in the data, in schema order.
const typeOptions = DOC_TYPES.filter((t) => stories.some((s) => s.type === t))
const topicOptions = TOPICS.filter((t) =>
  stories.some((s) => s.topics.includes(t)),
)
const featuredStories = stories.filter((s) => s.featured)

function pick<T extends string>(
  value: string | null,
  options: readonly T[],
): T | null {
  return options.find((o) => o === value) ?? null
}

export default function Feed() {
  useDocumentTitle()
  const [params, setParams] = useSearchParams()
  const type = pick<DocType>(params.get('type'), typeOptions)
  const topic = pick<Topic>(params.get('topic'), topicOptions)
  const filtered = type !== null || topic !== null

  const list = filtered
    ? stories.filter(
        (s) =>
          (!type || s.type === type) && (!topic || s.topics.includes(topic)),
      )
    : stories.filter((s) => !s.featured)
  const [lead, ...moreFeatured] = featuredStories

  // Keep the filters where the finger is when the featured section hides or returns.
  const barRef = useRef<HTMLDivElement>(null)
  const anchorTop = useRef<number | null>(null)
  const search = params.toString()
  useLayoutEffect(() => {
    if (anchorTop.current === null || !barRef.current) return
    window.scrollBy(
      0,
      barRef.current.getBoundingClientRect().top - anchorTop.current,
    )
    anchorTop.current = null
  }, [search])

  // Every change is a new history entry, so the browser's back button restores the previous filter.
  function setFilter(next: { type: DocType | null; topic: Topic | null }) {
    if (next.type === type && next.topic === topic) return
    anchorTop.current = barRef.current?.getBoundingClientRect().top ?? null
    const p = new URLSearchParams()
    if (next.type) p.set('type', next.type)
    if (next.topic) p.set('topic', next.topic)
    setParams(p)
  }
  const clear = () => setFilter({ type: null, topic: null })

  return (
    <div className="mx-auto max-w-page px-4 pt-8 md:px-8 md:pt-[72px]">
      <section aria-labelledby="hero-title">
        <h1 id="hero-title" className="text-display lg:text-display-lg">
          <SentenceLines text={copy.tagline} />
        </h1>
        <div className="mt-3.5 flex flex-col gap-4 md:mt-7 md:flex-row md:items-end md:justify-between md:gap-12">
          <p className="max-w-[600px] text-ink-2 md:text-[21px] md:leading-[31px]">
            {copy.feed.intro}
          </p>
          <p className="flex items-start gap-2.5 text-small font-semibold md:pb-1">
            <Icon name="checkCircle" className="size-5 text-accent" />
            {copy.principle}
          </p>
        </div>
      </section>

      {!filtered && lead && (
        <section aria-labelledby="featured-title" className="mt-9 lg:mt-16">
          <h2
            id="featured-title"
            className="text-[22px] leading-7 lg:text-[28px] lg:leading-[34px]"
          >
            {copy.feed.featured}
          </h2>
          <div
            className={`mt-3.5 grid gap-3 md:grid-cols-2 lg:mt-[18px] lg:gap-6 ${
              moreFeatured.length === 1 ? 'lg:grid-cols-[7fr_5fr]' : ''
            }`}
          >
            <LeadCard story={lead} />
            {moreFeatured.map((s) => (
              <FeatureCard key={s.id} story={s} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-title" className="mt-10 lg:mt-[72px]">
        <div ref={barRef} className="flex flex-col gap-3.5 lg:gap-[18px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2.5 whitespace-nowrap">
              <h2
                id="all-title"
                className="text-[22px] leading-7 lg:text-[28px] lg:leading-[34px]"
              >
                {copy.feed.all}
              </h2>
              <span
                aria-live="polite"
                className="text-small text-muted tabular-nums"
              >
                {copy.feed.count(list.length)}
              </span>
            </div>
            <TypeSelect
              options={typeOptions}
              value={type}
              onChange={(t) => setFilter({ type: t, topic })}
            />
          </div>
          <TopicChips
            options={topicOptions}
            value={topic}
            onSelect={(t) => setFilter({ type, topic: t })}
          />
          {filtered && (
            <button
              type="button"
              onClick={clear}
              className="-my-1.5 inline-flex min-h-11 items-center gap-1.5 self-end text-small font-semibold text-accent underline underline-offset-3 hover:no-underline"
            >
              <Icon name="close" className="size-4" />
              {copy.feed.clear}
            </button>
          )}
        </div>

        {list.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:mt-6 lg:gap-5">
            {list.map((s) => (
              <FeedCard key={s.id} story={s} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center">
            <p>{copy.feed.empty}</p>
            <button
              type="button"
              onClick={clear}
              className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-small font-semibold text-white"
            >
              {copy.feed.clear}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
