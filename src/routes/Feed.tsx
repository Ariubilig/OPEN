import { useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import FeedCard from '../components/FeedCard'
import FilterBar from '../components/FilterBar'
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

  // Keep the filter bar where the finger is when the featured section hides or returns.
  const barRef = useRef<HTMLElement>(null)
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
    <div className="mx-auto max-w-5xl px-4 pt-8">
      <h1 className="text-h1 md:text-h1-lg">{copy.tagline}</h1>
      <p className="mt-3 max-w-reading text-muted">{copy.feed.intro}</p>

      {!filtered && featuredStories.length > 0 && (
        <section aria-labelledby="featured-title" className="mt-10">
          <h2 id="featured-title" className="text-h2">
            {copy.feed.featured}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {featuredStories.map((s) => (
              <FeedCard key={s.id} story={s} size="large" />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <FilterBar
          ref={barRef}
          types={typeOptions}
          topics={topicOptions}
          type={type}
          topic={topic}
          onTypeChange={(t) => setFilter({ type: t, topic })}
          onTopicChange={(t) => setFilter({ type, topic: t })}
        />
      </div>

      <section aria-labelledby="all-title" className="mt-8">
        <div className="flex min-h-11 flex-wrap items-center gap-x-3">
          <h2 id="all-title" className="text-h2">
            {copy.feed.all}
          </h2>
          <span
            aria-live="polite"
            className="text-small text-muted tabular-nums"
          >
            {copy.feed.count(list.length)}
          </span>
          {filtered && (
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex min-h-11 items-center text-small font-semibold text-accent underline underline-offset-2"
            >
              {copy.feed.clear}
            </button>
          )}
        </div>

        {list.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {list.map((s) => (
              <FeedCard key={s.id} story={s} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-card border border-dashed border-line bg-surface p-6 text-center">
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
