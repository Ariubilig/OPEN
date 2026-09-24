import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import FeedCard, { FeatureCard, LeadCard } from '../components/FeedCard'
import { TopicChips, TypeSelect } from '../components/FilterBar'
import Following from '../components/Following'
import ForYou from '../components/ForYou'
import Icon from '../components/Icon'
import SearchField from '../components/SearchField'
import SentenceLines from '../components/SentenceLines'
import Tracker from '../components/Tracker'
import { copy } from '../copy'
import { stories } from '../data'
import {
  DOC_TYPES,
  TOPICS,
  type DocType,
  type Group,
  type Topic,
} from '../data/schema'
import { parseGroup } from '../lib/groups'
import { scrollBehavior } from '../lib/motion'
import { matchesQuery } from '../lib/search'
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

type Filters = {
  type: DocType | null
  topic: Topic | null
  group: Group | null
  q: string
}

export default function Feed() {
  useDocumentTitle()
  const [params, setParams] = useSearchParams()
  const type = pick<DocType>(params.get('type'), typeOptions)
  const topic = pick<Topic>(params.get('topic'), topicOptions)
  const group = parseGroup(params.get('group'))
  const q = params.get('q') ?? ''
  const query = q.trim()
  const filtered = type !== null || topic !== null || query !== ''

  const list = filtered
    ? stories.filter(
        (s) =>
          (!type || s.type === type) &&
          (!topic || s.topics.includes(topic)) &&
          matchesQuery(s, query),
      )
    : stories.filter((s) => !s.featured)
  const [lead, ...moreFeatured] = featuredStories

  // Keep the filters where the finger is when the sections above hide or return.
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

  // The header's search button: bring the search box into view and focus it.
  const searchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const focusSearch =
    (location.state as { focusSearch?: boolean } | null)?.focusSearch === true
  useEffect(() => {
    if (!focusSearch) return
    searchRef.current?.focus({ preventScroll: true })
    searchRef.current?.scrollIntoView({
      block: 'center',
      behavior: scrollBehavior(),
    })
    // forget the request, so a reload does not jump to the search box again
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: null },
    )
  }, [focusSearch, location.pathname, location.search, navigate])

  // Filter changes are history entries (the back button undoes them); typing replaces the entry.
  function update(next: Filters, replace = false) {
    const p = new URLSearchParams()
    if (next.q) p.set('q', next.q)
    if (next.type) p.set('type', next.type)
    if (next.topic) p.set('topic', next.topic)
    if (next.group) p.set('group', next.group)
    setParams(p, { replace })
  }
  function holdBar() {
    anchorTop.current = barRef.current?.getBoundingClientRect().top ?? null
  }
  function setFilter(next: { type: DocType | null; topic: Topic | null }) {
    if (next.type === type && next.topic === topic) return
    holdBar()
    update({ ...next, group, q })
  }
  function setQuery(next: string) {
    holdBar()
    update({ type, topic, group, q: next }, true)
  }
  const clear = () => {
    holdBar()
    update({ type: null, topic: null, group, q: '' })
  }
  // "Танд юу хамаатай вэ?" sits above the list and grows downwards: nothing to anchor.
  const setGroup = (next: Group | null) =>
    next !== group && update({ type, topic, group: next, q })

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

      {!filtered && <Following />}

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

      {!filtered && <Tracker stories={stories} />}

      {!filtered && <ForYou group={group} onSelect={setGroup} />}

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
                {/* unfiltered, the featured stories sit above the list: count them too */}
                {copy.feed.count(filtered ? list.length : stories.length)}
              </span>
            </div>
            <TypeSelect
              options={typeOptions}
              value={type}
              onChange={(t) => setFilter({ type: t, topic })}
            />
          </div>
          <SearchField value={q} onChange={setQuery} inputRef={searchRef} />
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
            <p className="break-words">
              {query ? copy.search.empty(query) : copy.feed.empty}
            </p>
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
