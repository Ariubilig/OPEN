import { describe, expect, it } from 'vitest'
import { taxRules } from '../src/data'
import { computePIT, type Bracket } from '../src/lib/tax'

type Expected = number | 'unverified'

// Monthly salary → monthly tax per year in src/data/taxRules.json.
// Brackets: ХХОАТ-ын тухай хууль 21.1 (legalinfo.mn lawId=14410): the text in force until 2026-12-31
// ("Өмнөх агуулга"), 21.1.1 for 2027 and 21.1.2 from 2028 — annual amounts divided by 12.
// Cross-check: the law's own cumulative amounts, e.g. 144 960₮/yr at 24M → 12,080₮/month at 2M.
const table: {
  salary: number
  2026: Expected
  2027: Expected
  2028: Expected
}[] = [
  { salary: 500_000, 2026: 50_000, 2027: 0, 2028: 0 },
  { salary: 792_000, 2026: 79_200, 2027: 0, 2028: 0 },
  { salary: 1_000_000, 2026: 100_000, 2027: 20_800, 2028: 2_080 },
  { salary: 2_000_000, 2026: 200_000, 2027: 120_800, 2028: 12_080 }, // source example: 200,000₮ → ~12,000₮
  { salary: 3_000_000, 2026: 300_000, 2027: 220_800, 2028: 112_080 },
  { salary: 12_000_000, 2026: 1_300_000, 2027: 1_220_800, 2028: 1_112_080 }, // 15% band
  { salary: 20_000_000, 2026: 2_750_000, 2027: 2_670_800, 2028: 2_562_080 }, // 20% band
]

const bracketsFor = (year: number): Bracket[] => {
  const y = taxRules.years.find((r) => r.year === year)
  if (!y) throw new Error(`taxRules.json has no year ${year}`)
  return y.brackets
}

describe('computePIT with taxRules.json', () => {
  for (const year of [2026, 2027, 2028] as const) {
    describe(String(year), () => {
      it.each(table.map((row) => [row.salary, row[year]] as const))(
        'salary %d → %s',
        (salary, expected) => {
          const result = computePIT(salary, bracketsFor(year))
          if (expected === 'unverified') {
            expect(result).toEqual({ status: 'unverified' })
          } else {
            expect(result).toEqual({ status: 'ok', tax: expected })
          }
        },
      )
    })
  }
})

describe('computePIT edge cases', () => {
  const brackets: Bracket[] = [
    { upTo: 100, rate: 0 },
    { upTo: 200, rate: 0.1 },
    { upTo: null, rate: 'TODO_VERIFY' },
  ]

  it('zero salary is zero tax', () => {
    expect(computePIT(0, brackets)).toEqual({ status: 'ok', tax: 0 })
  })

  it('a salary exactly on a bracket edge stays in the lower bracket', () => {
    expect(computePIT(200, brackets)).toEqual({ status: 'ok', tax: 10 })
  })

  it('one tugrik into an unverified bracket makes the result unverified', () => {
    expect(computePIT(201, brackets)).toEqual({ status: 'unverified' })
  })

  it('rounds to whole tugrik', () => {
    expect(computePIT(105, brackets)).toEqual({ status: 'ok', tax: 1 })
  })
})
