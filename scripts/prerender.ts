// After `vite build`: per-story HTML with its own link-preview tags and image, sitemap.xml, the
// RSS feeds and robots.txt, from the stories published in Supabase. Run by `npm run build`.
//
// Needs SITE_URL (the public origin) and VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, from the
// environment or .env files. Without them, or when the database cannot be reached, it warns and
// leaves the single-page app as it is: the site works, link previews are the generic ones.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { APP_NAME } from '../src/config.ts'
import { copy } from '../src/copy.ts'
import { StorySchema, TOPICS, TODO } from '../src/data/schema.ts'
import { topicFeedPath } from '../src/lib/feeds.ts'
import { siteImage, storyImage } from './og-image.ts'
import {
  homeHead,
  robots,
  rss,
  sitemap,
  storyHead,
  type PreviewImage,
  type PublishedStory,
} from './prerender-lib.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST = join(ROOT, 'dist')
const env = loadEnv(process.env.MODE ?? 'production', ROOT, '')
const siteUrl = (env.SITE_URL ?? '').replace(/\/+$/, '') || null
const apiUrl = env.VITE_SUPABASE_URL ?? ''
const key = env.VITE_SUPABASE_ANON_KEY ?? ''

const warn = (message: string) => console.warn(`prerender: ${message}`)
const write = (path: string, data: string | Uint8Array) => {
  mkdirSync(join(DIST, path, '..'), { recursive: true })
  writeFileSync(join(DIST, path), data)
}

/**
 * og/<id>.png per story and og/site.png. The URL carries the publish time, so a republished
 * story's new image is not hidden behind a cached old one. A failure costs the images, not the
 * build: the pages then keep the text-only preview.
 */
async function previewImages(
  stories: PublishedStory[],
  siteUrl: string,
): Promise<{ site?: PreviewImage; byId: Map<string, PreviewImage> }> {
  const byId = new Map<string, PreviewImage>()
  try {
    write('og/site.png', await siteImage())
    const site = {
      url: `${siteUrl}/og/site.png`,
      alt: `${APP_NAME} — ${copy.tagline}`,
    }
    for (const { story, publishedAt } of stories) {
      write(`og/${story.id}.png`, await storyImage(story))
      byId.set(story.id, {
        url: `${siteUrl}/og/${story.id}.png?v=${Date.parse(publishedAt) / 1000}`,
        alt: story.title.replaceAll(TODO, copy.placeholder),
      })
    }
    return { site, byId }
  } catch (e) {
    warn(`preview images skipped (${(e as Error).message})`)
    return { byId: new Map() }
  }
}

async function publishedStories(): Promise<PublishedStory[]> {
  const headers: Record<string, string> = { apikey: key }
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`
  const response = await fetch(
    `${apiUrl}/rest/v1/published_stories?select=content,published_at&order=published_at.desc`,
    { headers, signal: AbortSignal.timeout(20_000) },
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const rows = (await response.json()) as {
    content: unknown
    published_at: string
  }[]
  return rows.flatMap((row) => {
    const parsed = StorySchema.safeParse(row.content)
    if (!parsed.success) {
      warn(`skipped a story that does not match the schema`)
      return []
    }
    return [{ story: parsed.data, publishedAt: row.published_at }]
  })
}

async function main() {
  const template = readFileSync(join(DIST, 'index.html'), 'utf8')
  write('robots.txt', robots(siteUrl))

  if (!siteUrl || !apiUrl || !key) {
    warn(
      'SITE_URL or the Supabase URL/key is not set: no story pages, sitemap or feed',
    )
    return
  }

  let stories: PublishedStory[]
  try {
    stories = await publishedStories()
  } catch (e) {
    warn(`could not read published stories (${(e as Error).message}): skipped`)
    return
  }

  const images = await previewImages(stories, siteUrl)
  write('index.html', homeHead(template, siteUrl, images.site))
  for (const published of stories) {
    // story/<id>.html: served at /story/<id> by Vercel (cleanUrls), Netlify and vite preview
    write(
      `story/${published.story.id}.html`,
      storyHead(
        template,
        published,
        siteUrl,
        images.byId.get(published.story.id),
      ),
    )
  }
  write('sitemap.xml', sitemap(stories, siteUrl))
  write('rss.xml', rss(stories, siteUrl))
  // every topic, also one without stories yet: a reader can subscribe before the first one
  for (const topic of TOPICS)
    write(topicFeedPath(topic), rss(stories, siteUrl, topic))
  console.log(
    `prerender: ${stories.length} story pages, ${images.byId.size} preview images, sitemap.xml, rss.xml and ${TOPICS.length} topic feeds, robots.txt for ${siteUrl}`,
  )
}

await main()
