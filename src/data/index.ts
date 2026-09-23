import type { z } from 'zod'
import channelsJson from './channels.json'
import {
  ChannelsSchema,
  formatIssues,
  StorySchema,
  TaxRulesSchema,
  type Channel,
  type ChannelId,
  type Story,
} from './schema'
import taxRulesJson from './taxRules.json'

// Files starting with "_" are templates and are never bundled.
const storyFiles = import.meta.glob<unknown>(
  ['./stories/*.json', '!./stories/_*.json'],
  { eager: true, import: 'default' },
)

/** Validate one data file; throw an error that names the file and the JSON path of each problem. */
function parse<S extends z.ZodType>(
  file: string,
  schema: S,
  raw: unknown,
): z.output<S> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(
      `Invalid data in src/data/${file}:\n  ${formatIssues(result.error).join('\n  ')}`,
    )
  }
  return result.data
}

function isDraft(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { draft?: unknown }).draft === true
  )
}

function loadStories(): Story[] {
  const loaded: Story[] = []
  for (const [path, raw] of Object.entries(storyFiles)) {
    const file = path.replace(/^\.\//, '')
    // Drafts may be half-filled while the team works on them: skip before validating.
    if (file.startsWith('stories/_') || isDraft(raw)) continue
    loaded.push(parse(file, StorySchema, raw))
  }
  return loaded.sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      b.publishedAt.localeCompare(a.publishedAt),
  )
}

export const stories: Story[] = loadStories()

const storyById = new Map(stories.map((s) => [s.id, s]))

export function getStory(id: string): Story | undefined {
  return storyById.get(id)
}

export const channels: Channel[] = parse(
  'channels.json',
  ChannelsSchema,
  channelsJson,
)

const channelById = new Map(channels.map((c) => [c.id, c]))

export function getChannel(id: ChannelId): Channel | undefined {
  return channelById.get(id)
}

export const taxRules = parse('taxRules.json', TaxRulesSchema, taxRulesJson)
