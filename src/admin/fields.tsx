// Fields for editing JSON documents (stories, channels, tax rules). Each field takes the JSON path
// of its value and shows the validation message for that path from the nearest ErrorsProvider.
import { createContext, useContext, type ReactNode } from 'react'
import Placeholder from '../components/Placeholder'
import { TODO } from '../data/schema'
import { adminCopy } from './copy'
import { toJsonPath, type Path } from './doc'
import { Button, Checkbox, Field, Select, TextArea, TextInput } from './ui'

const c = adminCopy.common

const ErrorsContext = createContext<ReadonlyMap<string, string>>(new Map())

export function ErrorsProvider({
  errors,
  children,
}: {
  errors: ReadonlyMap<string, string>
  children: ReactNode
}) {
  return (
    <ErrorsContext.Provider value={errors}>{children}</ErrorsContext.Provider>
  )
}

export function useFieldError(path: Path): string | null {
  return useContext(ErrorsContext).get(toJsonPath(path)) ?? null
}

type Base = {
  label: ReactNode
  path: Path
  hint?: ReactNode
  optional?: boolean
  className?: string
}

/** A value marked unknown: the site's dashed placeholder and a way back to typing a value. */
function UnknownValue({ onFill }: { onFill: () => void }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-3">
      <Placeholder />
      <Button variant="ghost" onClick={onFill} className="px-3">
        {c.edit}
      </Button>
    </div>
  )
}

/** "Тодорхойгүй": sets the value to TODO_VERIFY (rendered as «Баталгаажуулах» on the site). */
function UnknownButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={c.unknownHint}
      className="min-h-11 shrink-0 rounded-full px-3 text-meta font-semibold text-muted hover:bg-paper hover:text-ink"
    >
      {c.unknown}
    </button>
  )
}

export function TextField({
  value,
  onChange,
  multiline = false,
  rows,
  allowUnknown = false,
  type,
  placeholder,
  ...base
}: Base & {
  value: string | undefined
  /** optional fields report `undefined` when emptied, so the key leaves the document */
  onChange: (value: string | undefined) => void
  multiline?: boolean
  rows?: number
  allowUnknown?: boolean
  type?: string
  placeholder?: string
}) {
  const error = useFieldError(base.path)
  const set = (v: string) => onChange(v === '' && base.optional ? undefined : v)
  return (
    <Field
      label={base.label}
      hint={base.hint}
      error={error}
      optional={base.optional}
      className={base.className}
      dataPath={toJsonPath(base.path)}
    >
      {(props) =>
        allowUnknown && value === TODO ? (
          <UnknownValue onFill={() => onChange('')} />
        ) : (
          <div className="flex items-start gap-1">
            {multiline ? (
              <TextArea
                {...props}
                rows={rows}
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => set(e.target.value)}
              />
            ) : (
              <TextInput
                {...props}
                type={type}
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => set(e.target.value)}
              />
            )}
            {allowUnknown && <UnknownButton onClick={() => onChange(TODO)} />}
          </div>
        )
      }
    </Field>
  )
}

/**
 * A YYYY-MM-DD date. `allowUnknown` adds TODO_VERIFY; `allowNull` adds "not scheduled" (null),
 * the timeline's way of saying a step has no date yet.
 */
export function DateField({
  value,
  onChange,
  allowUnknown = false,
  allowNull = false,
  ...base
}: Base & {
  value: string | null | undefined
  onChange: (value: string | null | undefined) => void
  allowUnknown?: boolean
  allowNull?: boolean
}) {
  const error = useFieldError(base.path)
  return (
    <Field
      label={base.label}
      hint={base.hint}
      error={error}
      optional={base.optional}
      className={base.className}
      dataPath={toJsonPath(base.path)}
    >
      {(props) =>
        allowUnknown && value === TODO ? (
          <UnknownValue onFill={() => onChange('')} />
        ) : allowNull && value === null ? (
          <div className="flex min-h-11 flex-wrap items-center gap-3">
            <span className="text-[15px] font-semibold">{c.notScheduled}</span>
            <Button
              variant="ghost"
              onClick={() => onChange('')}
              className="px-3"
            >
              {c.edit}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-1">
            <TextInput
              {...props}
              type="date"
              value={value ?? ''}
              onChange={(e) =>
                onChange(
                  e.target.value === '' && base.optional
                    ? undefined
                    : e.target.value,
                )
              }
              className="w-auto min-w-[11rem]"
            />
            {allowUnknown && <UnknownButton onClick={() => onChange(TODO)} />}
            {allowNull && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="min-h-11 rounded-full px-3 text-meta font-semibold text-muted hover:bg-paper hover:text-ink"
              >
                {c.notScheduled}
              </button>
            )}
          </div>
        )
      }
    </Field>
  )
}

export function SelectField<V extends string>({
  value,
  onChange,
  options,
  ...base
}: Base & {
  value: V | undefined
  onChange: (value: V | undefined) => void
  options: readonly { value: V; label: string }[]
}) {
  const error = useFieldError(base.path)
  return (
    <Field
      label={base.label}
      hint={base.hint}
      error={error}
      optional={base.optional}
      className={base.className}
      dataPath={toJsonPath(base.path)}
    >
      {(props) => (
        <Select
          {...props}
          value={value ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : (e.target.value as V))
          }
        >
          {(base.optional || value === undefined) && (
            <option value="">—</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

export function NumberField({
  value,
  onChange,
  step,
  min,
  ...base
}: Base & {
  value: number | undefined
  onChange: (value: number | undefined) => void
  step?: number | 'any'
  min?: number
}) {
  const error = useFieldError(base.path)
  return (
    <Field
      label={base.label}
      hint={base.hint}
      error={error}
      optional={base.optional}
      className={base.className}
      dataPath={toJsonPath(base.path)}
    >
      {(props) => (
        <TextInput
          {...props}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          className="max-w-[14rem] tabular-nums"
        />
      )}
    </Field>
  )
}

export function CheckboxField({
  label,
  hint,
  path,
  value,
  onChange,
}: {
  label: ReactNode
  hint?: ReactNode
  path: Path
  value: boolean
  onChange: (value: boolean) => void
}) {
  const error = useFieldError(path)
  return (
    <div data-path={toJsonPath(path)} className="scroll-mt-24">
      <Checkbox label={label} hint={hint} checked={value} onChange={onChange} />
      {error && (
        <p className="mt-1 text-meta font-semibold text-del-ink">{error}</p>
      )}
    </div>
  )
}

/** A block of fields for one list item, with move and remove buttons. */
export function ItemCard({
  title,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: ReactNode
  index: number
  count: number
  onMove: (delta: number) => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-paper/60 p-3 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-small font-bold">{title}</p>
        <div className="flex shrink-0 items-center">
          <IconButton
            label={c.moveUp}
            onClick={() => onMove(-1)}
            disabled={index === 0}
            path="M12 19V5M6 11l6-6 6 6"
          />
          <IconButton
            label={c.moveDown}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            path="M12 5v14M6 13l6 6 6-6"
          />
          <IconButton
            label={c.remove}
            onClick={onRemove}
            path="M6 6l12 12M18 6L6 18"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  path,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  path: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-30"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-[18px]"
      >
        <path d={path} />
      </svg>
    </button>
  )
}

/** "+ Нэмэх" under a list. */
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button variant="secondary" onClick={onClick} className="self-start">
      <span aria-hidden="true" className="text-[18px] leading-none">
        +
      </span>
      {children}
    </Button>
  )
}
