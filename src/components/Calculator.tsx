import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { copy } from '../copy'
import { taxRules } from '../data'
import { formatMNT, formatThousands } from '../lib/format'
import { computePIT, type PitResult } from '../lib/tax'
import Chip from './Chip'
import DataText from './DataText'
import ExternalLink from './ExternalLink'

const MAX_SALARY = 20_000_000
const PRESETS = [500_000, 792_000, 1_000_000, 2_000_000, 3_000_000]
const DEFAULT_SALARY = 2_000_000

/** Monthly personal income tax now / from 2027 / from 2028 (brief §7). */
export default function Calculator() {
  const [salary, setSalary] = useState<number | null>(DEFAULT_SALARY)
  const inputId = useId()
  const assumptionId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const caretDigits = useRef<number | null>(null)

  // Live thousands separators: keep the caret after the same number of digits.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (caretDigits.current === null || !input) return
    let seen = 0
    let pos = 0
    while (pos < input.value.length && seen < caretDigits.current) {
      if (/\d/.test(input.value[pos])) seen++
      pos++
    }
    input.setSelectionRange(pos, pos)
    caretDigits.current = null
  })

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const caret = e.target.selectionStart ?? raw.length
    caretDigits.current = raw.slice(0, caret).replace(/\D/g, '').length
    const digits = raw.replace(/\D/g, '')
    setSalary(digits ? Math.min(Number(digits), MAX_SALARY) : null)
  }

  const value = salary ?? 0
  const results = taxRules.years.map((y) => ({
    label: y.label,
    result: computePIT(value, y.brackets),
  }))
  const now = results[0]?.result

  return (
    <div>
      <label htmlFor={inputId} className="text-small font-semibold">
        {copy.calculator.label}
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={assumptionId}
          placeholder={copy.calculator.placeholder}
          value={salary === null ? '' : formatThousands(salary)}
          onChange={onChange}
          className="min-h-12 w-full rounded-card border border-line bg-surface py-2 pr-10 pl-4 font-serif text-[22px] font-bold tabular-nums placeholder:font-sans placeholder:text-body placeholder:font-normal placeholder:text-muted focus:border-accent"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
        >
          ₮
        </span>
      </div>

      <div role="group" aria-label={copy.calculator.presets} className="mt-3">
        <p className="text-small text-muted">{copy.calculator.presets}</p>
        <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {PRESETS.map((p) => (
            <Chip key={p} selected={salary === p} onClick={() => setSalary(p)}>
              {formatThousands(p)}
            </Chip>
          ))}
        </div>
      </div>

      {!taxRules.verified && (
        <p className="mt-5 rounded-lg border border-dashed border-placeholder-line bg-placeholder-bg px-3 py-2 text-small font-semibold text-placeholder-ink">
          {copy.calculator.rulesUnverified}
        </p>
      )}

      <ul aria-live="polite" className="mt-3 grid gap-3 sm:grid-cols-3">
        {results.map(({ label, result }) => (
          <ResultCard key={label} label={label} result={result} now={now} />
        ))}
      </ul>

      <div className="mt-4 space-y-1 text-small text-muted">
        <p id={assumptionId}>
          <DataText value={taxRules.assumption} />
        </p>
        <p>
          {copy.calculator.sourceLabel}:{' '}
          <ExternalLink href={taxRules.source.url}>
            {taxRules.source.publisher}
          </ExternalLink>
          <span aria-hidden="true"> · </span>
          {copy.calculator.lawLabel}:{' '}
          <ExternalLink href={taxRules.lawSource.url}>
            {taxRules.lawSource.title}
          </ExternalLink>
        </p>
      </div>
    </div>
  )
}

function ResultCard({
  label,
  result,
  now,
}: {
  label: string
  result: PitResult
  now: PitResult | undefined
}) {
  const saving =
    result.status === 'ok' && now?.status === 'ok' ? now.tax - result.tax : 0
  return (
    <li className="flex flex-col rounded-card border border-line bg-surface p-4">
      <p className="text-small font-semibold text-muted">
        <DataText value={label} />
      </p>
      {result.status === 'ok' ? (
        <>
          <p className="mt-1 font-serif text-[26px] leading-8 font-bold tabular-nums">
            {formatMNT(result.tax)}
          </p>
          <p className="text-small text-muted">{copy.calculator.perMonth}</p>
          {saving > 0 && (
            <p className="mt-2 self-start rounded-full bg-ins-bg px-2.5 py-0.5 text-small font-semibold text-ins-ink tabular-nums">
              {copy.calculator.less(formatMNT(saving))}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 self-start rounded-full border border-dashed border-placeholder-line bg-placeholder-bg px-2.5 py-0.5 text-small font-semibold text-placeholder-ink">
            {copy.calculator.unverified}
          </p>
          <p className="mt-2 text-small text-muted">
            {copy.calculator.unverifiedHelp}
          </p>
        </>
      )}
    </li>
  )
}
