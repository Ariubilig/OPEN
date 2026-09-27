import { Form, useLoaderData, useNavigation } from 'react-router'
import FeedCard from '../components/FeedCard'
import Icon from '../components/Icon'
import { copy } from '../copy'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { searchLoader } from './loaders'

const t = copy.search

/** /search?q=…: published stories whose title, summary or official title match the words. */
export default function Search() {
  const { query, cards } = useLoaderData<typeof searchLoader>()
  useDocumentTitle(query ? `${query} — ${t.title}` : t.title)
  const searching = useNavigation().state === 'loading'

  return (
    <div className="mx-auto max-w-page px-4 pt-8 md:px-8 md:pt-[72px]">
      <h1 className="text-h1 md:text-h1-lg">{t.title}</h1>
      <Form
        method="get"
        action="/search"
        role="search"
        className="mt-5 flex max-w-[720px] gap-2"
      >
        <label htmlFor="search-q" className="sr-only">
          {t.label}
        </label>
        <input
          id="search-q"
          key={query}
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t.placeholder}
          aria-describedby="search-hint"
          autoFocus={!query}
          maxLength={200}
          className="min-h-[52px] w-full min-w-0 rounded-full border border-line-strong bg-surface px-5 text-[17px] text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          className="inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          <Icon name="search" className="size-5" />
          <span className="hidden sm:inline">{t.submit}</span>
          <span className="sr-only sm:hidden">{t.submit}</span>
        </button>
      </Form>
      <p id="search-hint" className="mt-2 text-small text-muted">
        {t.hint}
      </p>

      {query && (
        <section
          aria-labelledby="results-title"
          aria-busy={searching}
          className="mt-8"
        >
          <h2
            id="results-title"
            aria-live="polite"
            className="text-small font-semibold text-ink-2 tabular-nums"
          >
            {cards.length > 0 ? t.results(cards.length) : t.empty(query)}
          </h2>
          {cards.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:gap-5">
              {cards.map((card) => (
                <FeedCard key={card.id} story={card} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
