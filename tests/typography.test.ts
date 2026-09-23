import { describe, expect, it } from 'vitest'
import { glueSegments, leadingSuffix } from '../src/lib/typography'

const glued = (text: string) =>
  glueSegments(text)
    .filter((s) => s.glued)
    .map((s) => s.text)

describe('glueSegments', () => {
  it('keeps numbers, acronyms and ranges together with their suffixes', () => {
    expect(
      glued(
        '2028 оны 1-р сарын 1-нээс 792,000₮-өөс 2,000,000₮ хүртэлх орлогод',
      ),
    ).toEqual(['1-р', '1-нээс', '792,000₮-өөс'])
    expect(glued('УИХ-ын 15–24 насны 6%-ийн зээлээр, E-Mongolia')).toEqual([
      'УИХ-ын',
      '15–24',
      '6%-ийн',
      'E-Mongolia',
    ])
  })

  it('keeps punctuation that sticks to the token', () => {
    expect(glued('хэсэгт 792,000–2,000,000₮, дараа нь')).toEqual([
      '792,000–2,000,000₮,',
    ])
  })

  it('returns the text unchanged, in order', () => {
    for (const text of [
      'Засгийн газар 2026 оны 8-р сарын 31-нд УИХ-д өргөн мэдүүлсэн.',
      'Энгийн өгүүлбэр.',
      '— зураас — ба –',
      '',
    ]) {
      expect(
        glueSegments(text)
          .map((s) => s.text)
          .join(''),
      ).toBe(text)
    }
  })

  it('leaves text without dashes as one plain segment', () => {
    expect(glueSegments('Хоёр мянган төгрөг')).toEqual([
      { text: 'Хоёр мянган төгрөг', glued: false },
    ])
  })
})

describe('leadingSuffix', () => {
  it('finds a case suffix right after a highlighted amount', () => {
    expect(leadingSuffix('-өөс 2,000,000₮ хүртэлх')).toBe('-өөс')
    expect(leadingSuffix('-ийн зээлээр')).toBe('-ийн')
    expect(leadingSuffix(' хүртэлх цалин')).toBe('')
    expect(leadingSuffix('')).toBe('')
  })
})
