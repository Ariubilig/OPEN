// Reads for the public site. Every row is checked with the zod contract: a story that does not
// parse is left out (and logged) instead of breaking the page it would appear on.
import { z } from 'zod'
import { db } from './client'
import {
  ChannelSchema,
  formatIssues,
  GROUPS,
  StorySchema,
  TaxRulesSchema,
  type Channel,
  type Group,
  type Story,
  type TaxRules,
} from './schema'

/** What a feed card needs (the `story_cards` view). */
export const StoryCardSchema = StorySchema.pick({
  id: true,
  type: true,
  stage: true,
  topics: true,
  featured: true,
  order: true,
  title: true,
  summary: true,
  publishedAt: true,
  timeline: true,
}).extend({
  sourceCount: z.number().int().min(0),
  groups: z.array(z.enum(GROUPS)),
})
export type StoryCard = z.infer<typeof StoryCardSchema>

export type SiteData = {
  channels: Channel[]
  /** null when the database has no tax rules: the calculator is left out */
  taxRules: TaxRules | null
}

/** A failed request to the database (network, server or permission). */
export class ApiError extends Error {
  readonly code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

type Result<D> = { data: D; error: { message: string; code?: string } | null }

/** The data of a successful request; a failed one throws an ApiError. */
function check<D>(result: Result<D>): D {
  if (result.error) throw new ApiError(result.error.message, result.error.code)
  return result.data
}

/** The rows of a successful list request. */
const rows = <R>(result: Result<R[] | null>): R[] => check(result) ?? []

/** Parse each item; skip (and log) the ones that do not match the contract. */
function parseEach<S extends z.ZodType>(
  what: string,
  schema: S,
  items: unknown[],
): z.output<S>[] {
  const parsed: z.output<S>[] = []
  for (const item of items) {
    const result = schema.safeParse(item)
    if (result.success) parsed.push(result.data)
    else
      console.error(
        `Skipped an invalid ${what} (${(item as { id?: unknown })?.id ?? '?'}):\n  ${formatIssues(result.error).join('\n  ')}`,
      )
  }
  return parsed
}

// ---- small cache: the same request within a minute reuses the answer ----------------------------

const TTL_MS = 60_000
const cache = new Map<string, { at: number; value: Promise<unknown> }>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Promise<T>
  const value = load()
  cache.set(key, { at: Date.now(), value })
  // a failed request is not remembered
  value.catch(() => cache.delete(key))
  return value
}

/** Forget cached answers (tests; the admin after publishing). */
export function clearCache() {
  cache.clear()
}

// ---- site-wide reference data ------------------------------------------------------------------

export function fetchSite(): Promise<SiteData> {
  return cached('site', async () => {
    // GET, so the responses can be cached like any other read
    const [channels, taxRules] = await Promise.all([
      db.rpc('get_channels', undefined, { get: true }).then(check),
      db.rpc('get_tax_rules', undefined, { get: true }).then(check),
    ])
    const rules = taxRules ? TaxRulesSchema.safeParse(taxRules) : null
    if (rules && !rules.success)
      console.error(
        `Invalid tax rules:\n  ${formatIssues(rules.error).join('\n  ')}`,
      )
    return {
      channels: parseEach(
        'channel',
        ChannelSchema,
        Array.isArray(channels) ? channels : [],
      ),
      taxRules: rules?.success ? rules.data : null,
    }
  })
}

// ---- story cards -------------------------------------------------------------------------------

const CARD_COLUMNS =
  'id, type, stage, topics, groups, featured, sort_order, published_on, title, summary, timeline, source_count'

type CardRow = {
  id: string | null
  type: string | null
  stage: string | null
  topics: string[] | null
  groups: string[] | null
  featured: boolean | null
  sort_order: number | null
  published_on: string | null
  title: string | null
  summary: unknown
  timeline: unknown
  source_count: number | null
}

const toCard = (r: CardRow) => ({
  id: r.id,
  type: r.type,
  stage: r.stage,
  topics: r.topics,
  groups: r.groups ?? [],
  featured: r.featured,
  ...(r.sort_order === null ? {} : { order: r.sort_order }),
  title: r.title,
  summary: r.summary,
  publishedAt: r.published_on,
  timeline: r.timeline,
  sourceCount: r.source_count,
})

/** Feed order: `order` first (featured stories are ordered), then newest first. */
function cards() {
  return db
    .from('story_cards')
    .select(CARD_COLUMNS)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('published_on', { ascending: false })
    .order('id')
}

/** Every published story as a card, in feed order. */
export function fetchCards(): Promise<StoryCard[]> {
  return cached('cards', async () =>
    parseEach('story card', StoryCardSchema, rows(await cards()).map(toCard)),
  )
}

/** Featured stories as cards (the not-found page offers them). */
export function fetchFeaturedCards(): Promise<StoryCard[]> {
  return cached('cards:featured', async () =>
    parseEach(
      'story card',
      StoryCardSchema,
      rows(await cards().eq('featured', true)).map(toCard),
    ),
  )
}

/** Cards for these ids, in the given order; unpublished or unknown ids are left out. */
export async function fetchCardsByIds(ids: string[]): Promise<StoryCard[]> {
  if (ids.length === 0) return []
  const found = await cached(`cards:${ids.join(',')}`, async () =>
    parseEach(
      'story card',
      StoryCardSchema,
      rows(await cards().in('id', ids)).map(toCard),
    ),
  )
  const byId = new Map(found.map((c) => [c.id, c]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

// ---- full stories ------------------------------------------------------------------------------

/** One published story, or null when there is no such story (or it does not parse). */
export function fetchStory(id: string): Promise<Story | null> {
  return cached(`story:${id}`, async () => {
    const row = check(
      await db
        .from('published_stories')
        .select('content')
        .eq('id', id)
        .maybeSingle(),
    )
    if (!row) return null
    return parseEach('story', StorySchema, [row.content])[0] ?? null
  })
}

/** Full stories that say something about `group`, in feed order ("Танд юу хамаатай вэ?"). */
export function fetchStoriesForGroup(group: Group): Promise<Story[]> {
  return cached(`group:${group}`, async () => {
    const found = rows(
      await db
        .from('published_stories')
        .select('content')
        .contains('groups', [group])
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('published_on', { ascending: false })
        .order('id'),
    )
    return parseEach(
      'story',
      StorySchema,
      found.map((r) => r.content),
    )
  })
}

// ---- search ------------------------------------------------------------------------------------

/** Published stories matching the words of `query`, best first (search_stories() in SQL). */
export function searchCards(query: string): Promise<StoryCard[]> {
  const q = query.trim()
  if (!q) return Promise.resolve([])
  return cached(`search:${q.toLowerCase()}`, async () =>
    parseEach(
      'story card',
      StoryCardSchema,
      rows(
        await db
          .rpc('search_stories', { p_query: q }, { get: true })
          .select(CARD_COLUMNS),
      ).map(toCard),
    ),
  )
}

// ---- writes a reader can make ------------------------------------------------------------------

/** "Алдаа мэдээлэх": a reader's note about an error in a published story. */
export async function submitReport(
  storyId: string,
  message: string,
  contact: string,
): Promise<void> {
  check(
    await db.rpc('submit_report', {
      p_story_id: storyId,
      p_message: message,
      p_contact: contact,
    }),
  )
}
