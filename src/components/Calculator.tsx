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

/** Monthly personal income tax now / from 2027 / from 2028 (brief §7), as bars on an ink card. */
export default function Calculator() {
  const [salary, setSalary] = useState<number | null>(DEFAULT_SALARY)
  const inputId = useId()
  const presetsId = useId()
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
  const top = Math.max(
    0,
    ...results.map(({ result }) => (result.status === 'ok' ? result.tax : 0)),
  )

  return (
    <div className="on-ink flex flex-col gap-[18px] rounded-card-lg bg-ink p-5 text-on-ink md:p-7">
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-small font-semibold text-on-ink-2"
        >
          {copy.calculator.label}
        </label>
        <div className="relative">
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
            className="h-16 w-full rounded-2xl border-[1.5px] border-ink-border bg-ink-raised pr-12 pl-[18px] text-[30px] font-extrabold tracking-[-0.02em] text-on-ink tabular-nums placeholder:text-body placeholder:font-normal placeholder:tracking-normal placeholder:text-on-ink-3 focus:border-highlight"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-[18px] -translate-y-1/2 text-[22px] font-bold text-on-ink-3"
          >
            ₮
          </span>
        </div>
      </div>

      <div
        role="group"
        aria-labelledby={presetsId}
        className="flex flex-col gap-2"
      >
        <p id={presetsId} className="text-meta text-on-ink-3">
          {copy.calculator.presets}
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Chip
              key={p}
              tone="dark"
              selected={salary === p}
              onClick={() => setSalary(p)}
            >
              {formatThousands(p)}
            </Chip>
          ))}
        </div>
      </div>

      {!taxRules.verified && (
        <p className="rounded-lg border border-dashed border-placeholder-line bg-placeholder-bg px-3 py-2 text-small font-semibold text-placeholder-ink">
          {copy.calculator.rulesUnverified}
        </p>
      )}

      <ul aria-live="polite" className="mt-1 flex flex-col">
        {results.map(({ label, result }, i) => (
          <ResultRow
            key={label}
            label={label}
            result={result}
            now={now}
            top={top}
            first={i === 0}
          />
        ))}
      </ul>

      <div className="flex flex-col border-t border-ink-line pt-3.5 text-meta leading-[19px] text-on-ink-2">
        <p id={assumptionId} className="mb-1">
          <DataText value={taxRules.assumption} />
        </p>
        <p className="flex items-baseline gap-x-1.5">
          <span className="shrink-0">{copy.calculator.sourceLabel}:</span>
          <ExternalLink href={taxRules.source.url} tone="highlight">
            {taxRules.source.publisher}
          </ExternalLink>
        </p>
        <p className="flex items-baseline gap-x-1.5">
          <span className="shrink-0">{copy.calculator.lawLabel}:</span>
          <ExternalLink href={taxRules.lawSource.url} tone="highlight">
            {taxRules.lawSource.title}
          </ExternalLink>
        </p>
      </div>
    </div>
  )
}

function ResultRow({
  label,
  result,
  now,
  top,
  first,
}: {
  label: string
  result: PitResult
  now: PitResult | undefined
  top: number
  first: boolean
}) {
  const saving =
    result.status === 'ok' && now?.status === 'ok' ? now.tax - result.tax : 0
  const width =
    result.status === 'ok' && top > 0
      ? Math.max((result.tax / top) * 100, 3)
      : 0
  return (
    <li className="flex flex-col gap-2.5 border-t border-ink-line py-4 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small font-semibold text-on-ink-2">
          <DataText value={label} />
        </span>
        {result.status === 'ok' ? (
          <span className="text-[24px] leading-[30px] font-extrabold tracking-[-0.02em] tabular-nums md:text-[28px]">
            {formatMNT(result.tax)}
            <span className="text-meta font-medium tracking-normal text-on-ink-3">
              {' '}
              {copy.calculator.perMonth}
            </span>
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-placeholder-line bg-placeholder-bg px-2.5 py-0.5 text-small font-semibold text-placeholder-ink">
            {copy.calculator.unverified}
          </span>
        )}
      </div>
      {result.status === 'ok' ? (
        <>
          <span
            aria-hidden="true"
            className="block h-2.5 rounded-full bg-ink-line"
          >
            <span
              className={`block h-2.5 rounded-full ${first ? 'bg-on-ink' : 'bg-highlight'}`}
              style={{ width: `${width}%` }}
            />
          </span>
          {saving > 0 && (
            <p className="self-end text-meta font-semibold text-highlight tabular-nums">
              {copy.calculator.less(formatMNT(saving))}
            </p>
          )}
        </>
      ) : (
        <p className="text-meta text-on-ink-2">
          {copy.calculator.unverifiedHelp}
        </p>
      )}
    </li>
  )
}
