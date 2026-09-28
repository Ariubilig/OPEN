import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/config'
import { copy } from '../src/copy'

// CLAUDE.md rule 6: these exact sentences must appear on every story / every page.
describe('copy', () => {
  it('keeps the required disclaimers verbatim', () => {
    expect(copy.footer.independent).toBe(
      `${APP_NAME} бол бие даасан иргэний мэдээллийн платформ. УИХ, Засгийн газрын албан ёсны сайт биш.`,
    )
    expect(copy.story.disclaimer).toBe(
      'Энэ нь мэдээлэл бөгөөд хуулийн зөвлөгөө биш.',
    )
    expect(copy.principle).toBe(
      'AI тайлбарлана. Албан ёсны эх сурвалж баталгаажуулна.',
    )
  })

  it('takes the product name from config', () => {
    expect(APP_NAME.length).toBeGreaterThan(0)
    expect(copy.about.intro.startsWith(APP_NAME)).toBe(true)
  })

  // CLAUDE.md rule 13: the site speaks as the product, never as a demo.
  it('has no demo or prototype wording in any UI string', () => {
    const strings: string[] = []
    const walk = (value: unknown) => {
      if (typeof value === 'string') strings.push(value)
      else if (typeof value === 'function') strings.push(String(value(1, 2)))
      else if (value && typeof value === 'object')
        Object.values(value).forEach(walk)
    }
    walk(copy)
    const banned = /демо|прототип|хакатон|гараар|урьдчилан бэлтгэсэн/i
    expect(strings.filter((s) => banned.test(s))).toEqual([])
  })
})
