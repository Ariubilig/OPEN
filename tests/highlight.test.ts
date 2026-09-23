import { describe, expect, it } from 'vitest'
import { stories } from '../src/data'
import { splitFirstAmount } from '../src/lib/highlight'

describe('splitFirstAmount', () => {
  it('finds the first amount as the data writes it', () => {
    expect(
      splitFirstAmount(
        '2027 оноос сарын 792,000₮ хүртэлх цалин татвараас чөлөөлөгдөнө',
      ),
    ).toEqual([
      '2027 оноос сарын ',
      '792,000₮',
      ' хүртэлх цалин татвараас чөлөөлөгдөнө',
    ])
    expect(
      splitFirstAmount(
        'зарлага 43.6 их наяд, алдагдал 2.3 их наяд төгрөг',
      )?.[1],
    ).toBe('43.6 их наяд')
    expect(splitFirstAmount('гарт 840 тэрбум төгрөг үлдэнэ')?.[1]).toBe(
      '840 тэрбум төгрөг',
    )
    expect(splitFirstAmount('792,000–2,000,000₮ хэсэгт 1%')?.[1]).toBe(
      '792,000–2,000,000₮',
    )
    expect(splitFirstAmount('1%-ийн шатлал')?.[1]).toBe('1%')
    // "төгрөг" joins only as a whole word, not as the stem of a suffixed form
    expect(
      splitFirstAmount('төсөв 2.306 их наяд төгрөгийн алдагдалтай')?.[1],
    ).toBe('2.306 их наяд')
  })

  it('leaves years, dates and plain counts alone', () => {
    expect(splitFirstAmount('2028 оны 1-р сарын 1-нээс')).toBeNull()
    expect(splitFirstAmount('2026.06.26-нд баталсан')).toBeNull()
    expect(splitFirstAmount('8,186 удаа үзсэн')).toBeNull()
    expect(splitFirstAmount('TODO_VERIFY')).toBeNull()
  })

  it('keeps the whole text: before + amount + after', () => {
    for (const s of stories) {
      const parts = splitFirstAmount(s.title)
      if (parts) expect(parts.join('')).toBe(s.title)
    }
  })
})
