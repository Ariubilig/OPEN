import { Link, useLoaderData } from 'react-router'
import Icon from '../components/Icon'
import RelatedStories, { type RelatedItem } from '../components/RelatedStories'
import { copy } from '../copy'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import type { notFoundLoader } from './loaders'

/** Unknown path or story id: say so, offer the way home and the featured stories. */
export function NotFoundPage({ featured }: { featured: RelatedItem[] }) {
  useDocumentTitle(copy.notFound.title)
  return (
    <div className="mx-auto max-w-reading px-4 pt-10 md:pt-[72px]">
      <p
        aria-hidden="true"
        className="inline-block -rotate-2 rounded-xl bg-highlight px-3 text-[56px] leading-[68px] font-extrabold tracking-[-0.04em] text-ink tabular-nums md:text-[72px] md:leading-[84px]"
      >
        404
      </p>
      <h1 className="mt-5 text-h1 md:text-h1-lg">{copy.notFound.title}</h1>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-ink px-6 font-semibold text-white transition-colors hover:bg-accent-strong"
      >
        <Icon name="arrowLeft" className="size-5" />
        {copy.notFound.back}
      </Link>

      {featured.length > 0 && (
        <section aria-labelledby="not-found-featured" className="mt-12">
          <h2
            id="not-found-featured"
            className="mb-4 text-[22px] leading-7 lg:text-h2-lg"
          >
            {copy.feed.featured}
          </h2>
          <RelatedStories stories={featured} />
        </section>
      )}
    </div>
  )
}

/** The catch-all route. */
export default function NotFound() {
  const { featured } = useLoaderData<typeof notFoundLoader>()
  return <NotFoundPage featured={featured} />
}
