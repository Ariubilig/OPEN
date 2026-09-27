// Route loaders: each page's data is fetched before the page renders (React Router data mode).
import type { LoaderFunctionArgs, ShouldRevalidateFunction } from 'react-router'
import {
  fetchCards,
  fetchCardsByIds,
  fetchFeaturedCards,
  fetchSite,
  fetchStoriesForGroup,
  fetchStory,
  searchCards,
} from '../data/api'
import { parseGroup } from '../lib/groups'

/** Channels and tax rules for every page. */
export const rootLoader = () => fetchSite()

// Loaded once: reference data does not change while someone reads.
export const rootShouldRevalidate: ShouldRevalidateFunction = () => false

export async function feedLoader({ request }: LoaderFunctionArgs) {
  const group = parseGroup(new URL(request.url).searchParams.get('group'))
  const [cards, groupStories] = await Promise.all([
    fetchCards(),
    group ? fetchStoriesForGroup(group) : null,
  ])
  return { cards, groupStories }
}

// Type and topic filters work on the loaded cards; only a new group needs new stories.
export const feedShouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname !== nextUrl.pathname
    ? defaultShouldRevalidate
    : currentUrl.searchParams.get('group') !== nextUrl.searchParams.get('group')

export async function storyLoader({ params }: LoaderFunctionArgs) {
  const story = await fetchStory(params.id ?? '')
  if (!story)
    return { story: null, related: [], featured: await fetchFeaturedCards() }
  const related = await fetchCardsByIds(
    (story.relatedStoryIds ?? []).filter((id) => id !== story.id),
  )
  return { story, related, featured: [] }
}

// `?group=` on a story only preselects the "Хэнд хамаатай вэ?" filter.
export const storyShouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname !== nextUrl.pathname ? defaultShouldRevalidate : false

export async function searchLoader({ request }: LoaderFunctionArgs) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim()
  return { query, cards: query ? await searchCards(query) : [] }
}

export async function notFoundLoader() {
  return { featured: await fetchFeaturedCards() }
}
