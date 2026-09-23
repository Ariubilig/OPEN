import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../src/config'
import { copy } from '../src/copy'

// CLAUDE.md rule 6: these exact sentences must appear on every story / every page.
describe('copy', () => {
  it('keeps the required disclaimers verbatim', () => {
    expect(copy.footer.prototype).toBe(
      'Энэ бол хакатоны прототип. УИХ-ын албан ёсны сайт биш.',
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
})
