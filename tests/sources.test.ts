import { describe, expect, it } from 'vitest'
import { getStory, stories } from '../src/data'
import { numberSources } from '../src/lib/sources'

describe('numberSources', () => {
  it('numbers every source 1..n exactly once', () => {
    for (const s of stories) {
      const numbers = [...numberSources(s).values()].sort((a, b) => a - b)
      expect(numbers).toEqual(s.sources.map((_, i) => i + 1))
    }
  })

  it('follows render order: title → summary → changes → … → evidence', () => {
    const tax = numberSources(getStory('tax-package-2026')!)
    expect(Object.fromEntries(tax)).toEqual({
      'ikon-tax': 1, // official title
      'legalinfo-pit': 2, // changes[0].lawSource
      'gov-9-decisions': 3, // meaning[3]
      'parliament-tax-submitted': 4, // timeline[0]
      'arslan-budget': 5, // evidence: Төсөв
      'ikon-fiscal-council': 6,
    })

    const budget = numberSources(getStory('budget-2027')!)
    expect(Object.fromEntries(budget)).toEqual({
      'ikon-budget': 1, // official title
      'gogo-budget': 2, // summary
      'arslan-budget': 3, // key numbers
      'legalinfo-fiscal-stability': 4, // explainer
      'ikon-fiscal-council': 5, // positions
      'gov-9-decisions': 6, // timeline
      'ubn-fiscal-council': 7, // evidence
      'med-public-hearing': 8,
    })
  })

  it('skips references whose text or source is TODO_VERIFY', () => {
    // officialTitle is TODO_VERIFY → numbering starts at the summary
    const emeelt = numberSources(getStory('emeelt-power-plant')!)
    expect(emeelt.get('ikon-emeelt')).toBe(1)
  })
})
