// What scripts/prerender.ts writes, as pure functions: per-story <head> tags for link previews,
// the sitemap and the RSS feed. No file or network access here, so tests can run it.
import { APP_NAME } from '../src/config.ts'
import { copy } from '../src/copy.ts'
import { TODO, type Story, type Topic } from '../src/data/schema.ts'
import { topicFeedPath } from '../src/lib/feeds.ts'

export type PublishedStory = {
  story: Story
  /** when it was last published (timestamptz) */
  publishedAt: string
}

export const escapeHtml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

/** Data text for places that cannot show the dashed placeholder: TODO_VERIFY as its label. */
export const plain = (s: string) => s.replaceAll(TODO, copy.placeholder)

const clip = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s

export const storyUrl = (siteUrl: string, id: string) =>
  `${siteUrl}/story/${id}`

/**
 * The page's <head> for one story: title, description, Open Graph and article tags, the
 * canonical URL, and NewsArticle structured data. Replaces the site-wide tags in index.html.
 */
export function storyHead(
  template: string,
  { story, publishedAt }: PublishedStory,
  siteUrl: string,
): string {
  const title = plain(story.title)
  const description = clip(plain(story.summary.text), 300)
  const url = storyUrl(siteUrl, story.id)
  const modified = story.updatedAt ?? story.publishedAt
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: clip(title, 110),
    description,
    inLanguage: 'mn',
    url,
    mainEntityOfPage: url,
    datePublished: story.publishedAt,
    dateModified: modified,
    publisher: { '@type': 'Organization', name: APP_NAME, url: siteUrl },
    isBasedOn: story.sources
      .filter((s) => s.kind === 'official' && s.url !== TODO)
      .map((s) => s.url),
  }
  const extra = [
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="article:published_time" content="${escapeHtml(story.publishedAt)}" />`,
    `<meta property="article:modified_time" content="${escapeHtml(publishedAt)}" />`,
    // `<` escaped so the JSON can never close the script element
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>`,
  ]
  const replacements: [RegExp, string][] = [
    [
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(`${title} — ${APP_NAME}`)}</title>`,
    ],
    [
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta property="og:type" content="[^"]*" \/>/,
      '<meta property="og:type" content="article" />',
    ],
    [
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ],
    [/<\/head>/, `    ${extra.join('\n    ')}\n  </head>`],
  ]
  // a tag that is not in index.html (after an edit there) is a build error, not a silent miss
  return replacements.reduce((html, [pattern, value]) => {
    if (!pattern.test(html))
      throw new Error(`prerender: index.html has no ${pattern.source}`)
    // a function, so "$&" or "$'" in story text is inserted as written, not as a pattern
    return html.replace(pattern, () => value)
  }, template)
}

/** The home page's canonical URL and og:url. */
export function homeHead(template: string, siteUrl: string): string {
  const url = escapeHtml(`${siteUrl}/`)
  return template.replace(
    '</head>',
    () =>
      `    <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`,
  )
}

export function sitemap(stories: PublishedStory[], siteUrl: string): string {
  const url = (loc: string, lastmod?: string) =>
    `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url(`${siteUrl}/`),
    url(`${siteUrl}/about`),
    ...stories.map((p) => url(storyUrl(siteUrl, p.story.id), p.publishedAt)),
    '</urlset>',
    '',
  ].join('\n')
}

/** RFC 822 date for RSS. */
const rfc822 = (iso: string) => new Date(iso).toUTCString()

/** The newest stories first, like a news feed; with `topic`, only that topic's stories. */
export function rss(
  stories: PublishedStory[],
  siteUrl: string,
  topic?: Topic,
): string {
  const self = topic ? topicFeedPath(topic) : 'rss.xml'
  const page = topic
    ? `${siteUrl}/?${new URLSearchParams({ topic })}`
    : `${siteUrl}/`
  const items = stories
    .filter(({ story }) => !topic || story.topics.includes(topic))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 50)
    .map(({ story, publishedAt }) =>
      [
        '    <item>',
        `      <title>${escapeHtml(plain(story.title))}</title>`,
        `      <link>${escapeHtml(storyUrl(siteUrl, story.id))}</link>`,
        `      <guid isPermaLink="true">${escapeHtml(storyUrl(siteUrl, story.id))}</guid>`,
        `      <pubDate>${rfc822(publishedAt)}</pubDate>`,
        `      <category>${escapeHtml(story.type)}</category>`,
        `      <description>${escapeHtml(plain(story.summary.text))}</description>`,
        '    </item>',
      ].join('\n'),
    )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeHtml(`${APP_NAME} — ${topic ?? copy.tagline}`)}</title>`,
    `    <link>${escapeHtml(page)}</link>`,
    `    <atom:link href="${escapeHtml(`${siteUrl}/${self}`)}" rel="self" type="application/rss+xml" />`,
    `    <description>${escapeHtml(copy.feed.intro)}</description>`,
    '    <language>mn</language>',
    ...items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')
}

export function robots(siteUrl: string | null): string {
  return [
    'User-agent: *',
    'Disallow: /admin',
    ...(siteUrl ? [`Sitemap: ${siteUrl}/sitemap.xml`] : []),
    '',
  ].join('\n')
}
