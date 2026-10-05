import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  homeHead,
  robots,
  rss,
  sitemap,
  storyHead,
  type PublishedStory,
} from '../scripts/prerender-lib'
import { copy } from '../src/copy'
import { TODO, TOPICS } from '../src/data/schema'
import { TOPIC_SLUGS, topicFeedPath } from '../src/lib/feeds'
import { getStory } from './fixtures'

const template = `<!doctype html>
<html lang="mn">
  <head>
    <meta name="description" content="site" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="site" />
    <meta property="og:description" content="site" />
    <meta name="twitter:card" content="summary" />
    <title>site</title>
  </head>
  <body><div id="root"></div></body>
</html>`

const SITE = 'https://tod.example'
const published: PublishedStory = {
  story: getStory('tax-package-2026')!,
  publishedAt: '2026-09-25T04:00:00Z',
}

describe('storyHead', () => {
  const html = storyHead(template, published, SITE)

  it('gives the story its own title, description and Open Graph tags', () => {
    expect(html).toContain(
      '<title>2027 оноос сарын 792,000₮ хүртэлх цалин татвараас чөлөөлөгдөнө — Тод</title>',
    )
    expect(html).toContain('<meta property="og:type" content="article" />')
    expect(html).toContain(
      '<link rel="canonical" href="https://tod.example/story/tax-package-2026" />',
    )
    expect(html).not.toContain('content="site"')
  })

  it('adds NewsArticle data that cannot break out of its script', () => {
    const json = /<script type="application\/ld\+json">(.*)<\/script>/.exec(
      html,
    )![1]
    const data = JSON.parse(json)
    expect(data['@type']).toBe('NewsArticle')
    expect(data.datePublished).toBe('2026-09-25')
    expect(data.isBasedOn).toContain(
      'https://legalinfo.mn/mn/detail?lawId=14410',
    )
    const tricky = storyHead(
      template,
      {
        ...published,
        story: { ...published.story, title: '</script><script>alert(1)' },
      },
      SITE,
    )
    expect(tricky.match(/<\/script>/g)).toHaveLength(1)
  })

  it('never shows TODO_VERIFY', () => {
    const html2 = storyHead(
      template,
      {
        ...published,
        story: {
          ...published.story,
          summary: { text: `Хууль ${TODO}`, source: 's' },
        },
      },
      SITE,
    )
    expect(html2).not.toContain(TODO)
    expect(html2).toContain(`Хууль ${copy.placeholder}`)
  })

  it('adds the preview image and a large card when there is one', () => {
    const image = { url: `${SITE}/og/tax-package-2026.png?v=1`, alt: 'Гарчиг' }
    const withImage = storyHead(template, published, SITE, image)
    expect(withImage).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    )
    expect(withImage).toContain(
      '<meta property="og:image" content="https://tod.example/og/tax-package-2026.png?v=1" />',
    )
    expect(withImage).toContain(
      '<meta property="og:image:alt" content="Гарчиг" />',
    )
    // without one the page keeps the small text card
    expect(html).toContain('<meta name="twitter:card" content="summary" />')
    expect(html).not.toContain('og:image')
    const home = homeHead(template, SITE, {
      url: `${SITE}/og/site.png`,
      alt: 'Тод',
    })
    expect(home).toContain('content="summary_large_image"')
    expect(home).toContain(
      '<link rel="canonical" href="https://tod.example/" />',
    )
  })

  it('inserts "$" sequences in the text as written', () => {
    const title = "A $& B $' C $$ D"
    const html2 = storyHead(
      template,
      { ...published, story: { ...published.story, title } },
      SITE,
    )
    expect(html2).toContain(`<title>${escapeHtml(title)} — Тод</title>`)
    expect(html2).toContain(
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    )
    expect(homeHead(template, "https://tod.example/$'")).toContain(
      `<link rel="canonical" href="https://tod.example/$'/" />`,
    )
  })
})

describe('sitemap, rss, robots', () => {
  it('lists every story with absolute URLs', () => {
    const xml = sitemap([published], SITE)
    expect(xml).toContain(
      '<loc>https://tod.example/story/tax-package-2026</loc><lastmod>2026-09-25</lastmod>',
    )
    const feed = rss([published], SITE)
    expect(feed).toContain('<language>mn</language>')
    expect(feed).toContain('<pubDate>Fri, 25 Sep 2026 04:00:00 GMT</pubDate>')
  })

  it('writes a feed per topic with only the stories of that topic', () => {
    const housing: PublishedStory = {
      story: getStory('housing-16000')!,
      publishedAt: '2026-09-20T04:00:00Z',
    }
    const feed = rss([published, housing], SITE, 'Татвар')
    expect(feed).toContain('<title>Тод — Татвар</title>')
    expect(feed).toContain(
      '<atom:link href="https://tod.example/rss/tax.xml" rel="self"',
    )
    expect(feed).toContain('/story/tax-package-2026</link>')
    expect(feed).not.toContain('/story/housing-16000</link>')
    // the site-wide feed keeps both
    expect(rss([published, housing], SITE)).toContain(
      '/story/housing-16000</link>',
    )
  })

  it('names every topic feed with a unique, URL-safe slug', () => {
    const slugs = TOPICS.map((t) => TOPIC_SLUGS[t])
    expect(new Set(slugs).size).toBe(TOPICS.length)
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(topicFeedPath('Татвар')).toBe('rss/tax.xml')
  })

  it('keeps crawlers out of the admin', () => {
    expect(robots(SITE)).toContain('Disallow: /admin')
    expect(robots(null)).not.toContain('Sitemap')
  })
})

describe('storyHead on a changed template', () => {
  it('fails loudly when a tag it replaces is missing', () => {
    expect(() =>
      storyHead(
        template.replace(/<meta property="og:title"[^>]*>/, ''),
        published,
        SITE,
      ),
    ).toThrow(/og:title/)
  })
})
