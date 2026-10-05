import { describe, expect, it } from 'vitest'
import { OG_HEIGHT, OG_WIDTH, siteImage, storyImage } from '../scripts/og-image'
import { TODO } from '../src/data/schema'
import { getStory } from './fixtures'

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Buffer): [number, number] {
  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
  return [png.readUInt32BE(16), png.readUInt32BE(20)]
}

describe('preview images', () => {
  it('draws a story as a 1200×630 PNG', async () => {
    const png = await storyImage(getStory('tax-package-2026')!)
    expect(pngSize(png)).toEqual([OG_WIDTH, OG_HEIGHT])
  })

  it('draws a story whose title is not confirmed yet', async () => {
    const story = { ...getStory('housing-16000')!, title: `Шийдвэр ${TODO}` }
    expect(pngSize(await storyImage(story))).toEqual([OG_WIDTH, OG_HEIGHT])
  })

  it('draws the site image', async () => {
    expect(pngSize(await siteImage())).toEqual([OG_WIDTH, OG_HEIGHT])
  })
})
