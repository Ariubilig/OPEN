// The seed data (supabase/seed/) as parsed objects, for unit tests. The site itself reads
// published stories from the database; tests use the same documents the database is seeded with.
import type { z } from 'zod'
import channelsJson from '../supabase/seed/channels.json'
import taxRulesJson from '../supabase/seed/taxRules.json'
import {
  ChannelsSchema,
  formatIssues,
  StorySchema,
  TaxRulesSchema,
  type Channel,
  type ChannelId,
  type Story,
} from '../src/data/schema'

/** Every story file, templates and drafts included, unvalidated. */
export const rawStoryFiles = Object.entries(
  import.meta.glob<{ id: string; draft?: boolean }>(
    '../supabase/seed/stories/*.json',
    { eager: true, import: 'default' },
  ),
).map(([path, json]) => ({ file: path.split('/').pop()!, json }))

function parse<S extends z.ZodType>(
  file: string,
  schema: S,
  raw: unknown,
): z.output<S> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Invalid seed data in ${file}:\n  ${formatIssues(result.error).join('\n  ')}`,
    )
  }
  return result.data
}

/** Published seed stories in feed order: `order`, then newest first. */
export const stories: Story[] = rawStoryFiles
  .filter((f) => !f.file.startsWith('_') && f.json.draft !== true)
  .map((f) => parse(f.file, StorySchema, f.json))
  .sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      b.publishedAt.localeCompare(a.publishedAt),
  )

export function getStory(id: string): Story | undefined {
  return stories.find((s) => s.id === id)
}

export const channels: Channel[] = parse(
  'channels.json',
  ChannelsSchema,
  channelsJson,
)

export function getChannel(id: ChannelId): Channel | undefined {
  return channels.find((c) => c.id === id)
}

export const taxRules = parse('taxRules.json', TaxRulesSchema, taxRulesJson)
