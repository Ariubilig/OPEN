import { describe, expect, it } from 'vitest'
import { lawDiff } from '../src/lib/diff'

const show = (before: string, after: string) =>
  lawDiff(before, after).map(
    (p) => `${{ same: '=', added: '+', removed: '-' }[p.kind]}${p.text}`,
  )

describe('lawDiff', () => {
  it('keeps Mongolian words with ө and ү whole', () => {
    expect(
      show(
        'Хувь хүний орлогын албан татварыг 10 хувиар ногдуулна.',
        'Хувь хүний орлогын албан татварыг 1 хувиар өөрчлөн ногдуулна.',
      ),
    ).toEqual([
      '=Хувь хүний орлогын албан татварыг ',
      '-10',
      '+1',
      '= хувиар ',
      '+өөрчлөн ',
      '=ногдуулна.',
    ])
  })

  it('reconstructs both texts', () => {
    const before = '7.13. Ажил, хөдөлмөр эрхэлж байгаа оюутан үүнд хамаарахгүй.'
    const after =
      '7.13. Ажил, хөдөлмөр эрхэлж байгаа оюутан, суралцагч өөрөө хүсвэл чөлөөлөгдөнө.'
    const parts = lawDiff(before, after)
    const join = (skip: 'added' | 'removed') =>
      parts
        .filter((p) => p.kind !== skip)
        .map((p) => p.text)
        .join('')
    expect(join('added')).toBe(before)
    expect(join('removed')).toBe(after)
  })

  it('returns one unchanged part for identical texts', () => {
    expect(lawDiff('Өөрчлөлтгүй.', 'Өөрчлөлтгүй.')).toEqual([
      { kind: 'same', text: 'Өөрчлөлтгүй.' },
    ])
  })
})
