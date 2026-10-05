// Link-preview images (1200×630 PNG) for shared links, drawn at build time by scripts/prerender.ts:
// the wordmark, the document's type and stage, the title, and the "not an official site" line.
// No emblem, flag or government logo (CLAUDE.md rule 6). Build-time only: nothing here runs in
// the browser.
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'node:fs'
import satori from 'satori'
import { APP_NAME } from '../src/config.ts'
import { copy } from '../src/copy.ts'
import { TODO, type Story } from '../src/data/schema.ts'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

// the site's tokens (src/index.css)
const PAPER = '#f3f3ee'
const INK = '#121318'
const INK_2 = '#3f4350'
const MUTED = '#626776'
const HIGHLIGHT = '#e4fa4b'
const ON_INK = '#ffffff'

// Geologica as static WOFF (Satori does not read WOFF2), one family per subset: Satori uses one
// file per family name, and falls back glyph by glyph only along the font-family list. Digits and
// punctuation are in Latin, Ө Ү in Cyrillic Ext, ₮ in Latin Ext.
const SUBSETS = ['latin', 'cyrillic', 'cyrillic-ext', 'latin-ext'] as const
const FAMILY = SUBSETS.map((subset) => `Geologica ${subset}`).join(', ')
const WEIGHTS = [600, 800] as const

let fonts: Parameters<typeof satori>[1]['fonts'] | null = null
function loadFonts() {
  fonts ??= WEIGHTS.flatMap((weight) =>
    SUBSETS.map((subset) => ({
      name: `Geologica ${subset}`,
      weight,
      style: 'normal' as const,
      data: readFileSync(
        new URL(
          `../node_modules/@fontsource/geologica/files/geologica-${subset}-${weight}-normal.woff`,
          import.meta.url,
        ),
      ),
    })),
  )
  return fonts
}

/** Data text without the placeholder box an image cannot show: TODO_VERIFY as its label. */
const plain = (s: string) => s.replaceAll(TODO, copy.placeholder)

type Style = Record<string, string | number>
type Node = { type: string; props: { style: Style; children?: unknown } }
const div = (style: Style, children?: unknown): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
})

function wordmark(): Node {
  return div(
    {
      backgroundColor: HIGHLIGHT,
      color: INK,
      borderRadius: 14,
      padding: '4px 18px 8px',
      fontSize: 48,
      fontWeight: 800,
      letterSpacing: -1.5,
      transform: 'rotate(-2deg)',
    },
    APP_NAME,
  )
}

/** The ink band at the bottom: we are not an official site (copy.footer.independent). */
function independentBand(): Node {
  return div(
    {
      backgroundColor: INK,
      color: ON_INK,
      padding: '26px 64px',
      fontSize: 24,
      fontWeight: 600,
      lineHeight: 1.35,
    },
    copy.footer.independent,
  )
}

/** Long titles get a smaller size so they fit in four lines. */
function titleSize(title: string): number {
  if (title.length <= 60) return 64
  if (title.length <= 95) return 56
  return 48
}

function frame(top: Node, body: Node[]): Node {
  return div(
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      flexDirection: 'column',
      backgroundColor: PAPER,
      fontFamily: FAMILY,
      color: INK,
    },
    [
      div(
        {
          flexGrow: 1,
          flexDirection: 'column',
          padding: '52px 64px 40px',
          gap: 26,
        },
        [top, ...body],
      ),
      independentBand(),
    ],
  )
}

async function render(tree: Node): Promise<Buffer> {
  const svg = await satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: loadFonts(),
  })
  return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } })
    .render()
    .asPng()
}

/** One story: wordmark, "type · stage", and the title. */
export function storyImage(story: Story): Promise<Buffer> {
  const title = plain(story.title)
  return render(
    frame(div({ alignItems: 'center' }, [wordmark()]), [
      div(
        { fontSize: 30, fontWeight: 600, color: INK_2 },
        `${story.type} · ${story.stage}`,
      ),
      div(
        {
          fontSize: titleSize(title),
          fontWeight: 800,
          lineHeight: 1.12,
          letterSpacing: -1.5,
          lineClamp: 4,
        },
        title,
      ),
    ]),
  )
}

/** The site: wordmark, the tagline and what the site does. */
export function siteImage(): Promise<Buffer> {
  return render(
    frame(div({ alignItems: 'center' }, [wordmark()]), [
      div(
        { fontSize: 72, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 },
        copy.tagline,
      ),
      div(
        { fontSize: 30, fontWeight: 600, color: MUTED, lineHeight: 1.35 },
        copy.feed.intro,
      ),
    ]),
  )
}
