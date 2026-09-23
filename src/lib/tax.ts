import type { Bracket } from '../data/schema'

export type { Bracket }
export type PitResult = { status: 'ok'; tax: number } | { status: 'unverified' }

/**
 * Monthly personal income tax with marginal brackets (brief §7).
 * Bracket i covers (L_i, U_i] at rate r_i; L_1 = 0, L_(i+1) = U_i, U_last = ∞.
 * A 'TODO_VERIFY' rate makes the result unverified only if the salary reaches into that bracket.
 * Simplified reading: no social insurance deduction, no other credits.
 */
export function computePIT(salary: number, brackets: Bracket[]): PitResult {
  let lower = 0
  let tax = 0
  for (const b of brackets) {
    const upper = b.upTo ?? Infinity
    const portion = Math.max(0, Math.min(salary, upper) - lower)
    if (portion > 0) {
      if (b.rate === 'TODO_VERIFY') return { status: 'unverified' }
      tax += portion * b.rate
    }
    if (salary <= upper) break
    lower = upper
  }
  return { status: 'ok', tax: Math.round(tax) }
}
