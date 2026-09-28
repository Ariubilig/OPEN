import { describe, expect, it } from 'vitest'
import {
  robots,
  rss,
  sitemap,
  storyHead,
  type PublishedStory,
} from '../scripts/prerender-lib'
import { copy } from '../src/copy'
import { TODO } from '../src/data/schema'
import { getStory } from './fixtures'

const template = `<!doctype html>
<html lang="mn">
  <head>
    <meta name="description" content="site" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="site" />
    <meta property="og:description" content="site" />
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
