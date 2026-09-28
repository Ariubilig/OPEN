// Building blocks of the admin interface. Every control is at least 44px tall with a visible
// focus ring (CLAUDE.md rule 9); labels, hints and errors are tied to inputs for screen readers.
import {
  useCallback,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import Icon from '../components/Icon'
import { adminCopy } from './copy'
import { errorMessage } from './errors'
import type { StoryState } from './supabase'

// ---- buttons -----------------------------------------------------------------------------------

const BUTTON = {
  primary: 'bg-ink text-white hover:bg-accent-strong',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink',
  danger:
    'border border-del-ink/30 bg-del-bg text-del-ink hover:border-del-ink',
  ghost: 'text-accent hover:bg-accent-soft',
} as const

export function Button({
  variant = 'secondary',
  busy = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON
  busy?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] leading-5 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// ---- fields ------------------------------------------------------------------------------------

export type ControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/** Label, optional hint and error around one control; the control gets the ids through `children`. */
export function Field({
  label,
  hint,
  error,
  optional = false,
  children,
  className = '',
  dataPath,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: (props: ControlProps) => ReactNode
  className?: string
  /** JSON path of the value: the checks panel finds the field by it */
  dataPath?: string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div
      data-path={dataPath}
      className={`flex min-w-0 scroll-mt-24 flex-col gap-1.5 ${className}`}
    >
      <label htmlFor={id} className="text-small font-semibold">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-muted">
            ({adminCopy.common.optional})
          </span>
        )}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="text-meta text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-meta font-semibold text-del-ink">
          {error}
        </p>
      )}
    </div>
  )
}

const INPUT =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] leading-6 text-ink placeholder:text-muted aria-[invalid=true]:border-del-ink disabled:bg-paper disabled:text-muted'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  return <input className={`${INPUT} min-h-11 py-2 ${className}`} {...rest} />
}

/** Grows with its text (field-sizing), from `rows` lines. */
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', rows = 2, ...rest } = props
  return (
    <textarea
      rows={rows}
      className={`${INPUT} py-2.5 [field-sizing:content] ${className}`}
      {...rest}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props
  return (
    <select
      className={`${INPUT} min-h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat py-2 pr-10 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23121318' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    />
  )
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-[11px] size-5 shrink-0 accent-[var(--ink)]"
      />
      <div className="flex min-h-11 flex-col justify-center">
        <label htmlFor={id} className="text-[15px] leading-5 font-semibold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-meta text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}

// ---- messages, badges, layout ------------------------------------------------------------------

const NOTICE = {
  error: 'border-del-ink/30 bg-del-bg text-del-ink',
  success: 'border-ins-ink/30 bg-ins-bg text-ins-ink',
  warning: 'border-placeholder-line bg-placeholder-bg text-placeholder-ink',
  info: 'border-line bg-surface text-ink',
} as const

export function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: keyof typeof NOTICE
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[15px] leading-[22px] ${NOTICE[tone]} ${className}`}
    >
      <Icon
        name={tone === 'success' ? 'checkCircle' : 'info'}
        className="mt-0.5 size-[18px] shrink-0"
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

const STATE = {
  draft: 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]',
  in_review: 'bg-accent-soft text-accent-strong',
  changes_requested: 'bg-placeholder-bg text-placeholder-ink',
  published: 'bg-ins-bg text-ins-ink',
} as const satisfies Record<StoryState, string>

export function StateBadge({ state }: { state: StoryState }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full px-3 text-meta font-bold whitespace-nowrap ${STATE[state]}`}
    >
      {adminCopy.states[state]}
    </span>
  )
}

export function PageHeader({
  title,
  children,
}: {
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-h2 lg:text-h2-lg">{title}</h1>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  )
}

export function Panel({
  title,
  intro,
  children,
  id,
}: {
  title: ReactNode
  intro?: ReactNode
  children: ReactNode
  id?: string
}) {
  const headingId = useId()
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-6 rounded-card border border-line bg-surface p-4 md:p-6"
    >
      <h2
        id={headingId}
        className="text-[20px] leading-7 tracking-[-0.01em] lg:text-[22px]"
      >
        {title}
      </h2>
      {intro && <p className="mt-1 text-small text-ink-2">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

// ---- async actions -----------------------------------------------------------------------------

/**
 * Run an async action with a busy flag and a Mongolian error message.
 * `run` resolves to true when the action succeeded.
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(await errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }, [])
  return { run, busy, error, setError }
}
