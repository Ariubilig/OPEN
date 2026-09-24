import { describe, expect, it } from 'vitest'
import { stories } from '../src/data'
import { splitFirstAmount, splitNumberUnit } from '../src/lib/highlight'

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

describe('splitNumberUnit', () => {
  it('splits a number from its unit', () => {
    expect(splitNumberUnit('45.7 их наяд төгрөг')).toEqual([
      '45.7',
      'их наяд төгрөг',
    ])
    expect(splitNumberUnit('−2.306 их наяд төгрөг')).toEqual([
      '−2.306',
      'их наяд төгрөг',
    ])
    expect(splitNumberUnit('12,080₮')).toEqual(['12,080₮', ''])
    expect(splitNumberUnit('37.3%')).toEqual(['37.3%', ''])
  })

  it('leaves text and ranges alone', () => {
    expect(splitNumberUnit('Нийслэлийн төсөв')).toBeNull()
    expect(splitNumberUnit('2025–2028 онд')).toBeNull()
    expect(splitNumberUnit('TODO_VERIFY')).toBeNull()
  })

  it('splits every key number in the data without losing text', () => {
    for (const s of stories)
      for (const k of s.keyNumbers ?? []) {
        const parts = splitNumberUnit(k.value)
        if (parts) expect(parts.filter(Boolean).join(' ')).toBe(k.value.trim())
      }
  })
})
