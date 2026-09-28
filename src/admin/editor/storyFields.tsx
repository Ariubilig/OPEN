// Story fields bound to the working copy by path: each reads its value from the editor context
// and writes it back, so sections only say what goes where.
import { useState, type ReactNode } from 'react'
import { TODO } from '../../data/schema'
import { adminCopy } from '../copy'
import {
  getIn,
  insertIn,
  moveIn,
  removeIn,
  toJsonPath,
  type Path,
} from '../doc'
import {
  AddButton,
  CheckboxField,
  DateField,
  ItemCard,
  NumberField,
  SelectField,
  TextField,
  useFieldError,
} from '../fields'
import { Button, Field, Select } from '../ui'
import {
  asList,
  asNumber,
  asObject,
  asText,
  sourceOptions,
  useEditor,
} from './context'

const f = adminCopy.editor.fields
const c = adminCopy.common

type Common = {
  label: ReactNode
  path: Path
  hint?: ReactNode
  optional?: boolean
}

export function Text(
  props: Common & {
    multiline?: boolean
    rows?: number
    allowUnknown?: boolean
    type?: string
    className?: string
  },
) {
  const { content, set } = useEditor()
  return (
    <TextField
      {...props}
      value={asText(getIn(content, props.path))}
      onChange={(v) => set(props.path, v)}
    />
  )
}

export function DateValue(
  props: Common & { allowUnknown?: boolean; allowNull?: boolean },
) {
  const { content, set } = useEditor()
  const raw = getIn(content, props.path)
  return (
    <DateField
      {...props}
      value={raw === null ? null : asText(raw)}
      onChange={(v) => set(props.path, v)}
    />
  )
}

export function Choice<V extends string>(
  props: Common & { options: readonly { value: V; label: string }[] },
) {
  const { content, set } = useEditor()
  return (
    <SelectField
      {...props}
      value={asText(getIn(content, props.path)) as V | undefined}
      onChange={(v) => set(props.path, v)}
    />
  )
}

export function Num(props: Common & { step?: number | 'any'; min?: number }) {
  const { content, set } = useEditor()
  return (
    <NumberField
      {...props}
      value={asNumber(getIn(content, props.path))}
      onChange={(v) => set(props.path, v)}
    />
  )
}

export function Toggle({
  label,
  hint,
  path,
  on = true,
  off = false,
}: {
  label: ReactNode
  hint?: ReactNode
  path: Path
  /** the value stored when checked (e.g. 'pit' for the calculator) */
  on?: unknown
  /** the value stored when unchecked; undefined removes the key */
  off?: unknown
}) {
  const { content, set } = useEditor()
  return (
    <CheckboxField
      label={label}
      hint={hint}
      path={path}
      value={getIn(content, path) === on}
      onChange={(checked) => set(path, checked ? on : off)}
    />
  )
}

/** A source id from the story's own list, or "unknown" (TODO_VERIFY). */
export function SourceField({
  path,
  label = f.source,
  optional = false,
}: {
  path: Path
  label?: ReactNode
  optional?: boolean
}) {
  const { content, set } = useEditor()
  const error = useFieldError(path)
  const value = asText(getIn(content, path)) ?? ''
  const options = sourceOptions(content)
  const missing =
    value !== '' && value !== TODO && !options.some((o) => o.id === value)
  return (
    <Field
      label={label}
      error={error}
      optional={optional}
      dataPath={toJsonPath(path)}
    >
      {(props) => (
        <Select
          {...props}
          value={value}
          onChange={(e) =>
            set(path, e.target.value === '' ? undefined : e.target.value)
          }
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.id}
              {o.title
                ? ` — ${o.title.length > 60 ? `${o.title.slice(0, 59)}…` : o.title}`
                : ''}
            </option>
          ))}
          {missing && <option value={value}>{f.sourceMissing(value)}</option>}
          <option value={TODO}>{c.unknown}</option>
        </Select>
      )}
    </Field>
  )
}

/** The reviewer note (`verify`) of an item: hidden behind a button until there is one. */
export function NoteField({ path }: { path: Path }) {
  const { content } = useEditor()
  const existing = getIn(content, path)
  const [open, setOpen] = useState(existing !== undefined)
  if (!open && existing === undefined)
    return (
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="self-start px-3"
      >
        {f.addNote}
      </Button>
    )
  return (
    <Text label={f.note} hint={f.noteHint} path={path} optional multiline />
  )
}

/**
 * A cited sentence `{ text, source, verify? }`: the sentence, where it comes from, and an optional
 * note for the reviewer. Every content sentence on the site is one of these (CLAUDE.md rule 2).
 */
export function CitedField({
  path,
  label = f.sentence,
  hint,
}: {
  path: Path
  label?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div
      data-path={toJsonPath(path)}
      className="flex scroll-mt-24 flex-col gap-3"
    >
      <Text
        label={label}
        hint={hint}
        path={[...path, 'text']}
        multiline
        allowUnknown
      />
      <SourceField path={[...path, 'source']} />
      <NoteField path={[...path, 'verify']} />
    </div>
  )
}

/** Several values from a fixed list, as toggle chips (topics). */
export function MultiChoice<V extends string>({
  label,
  path,
  options,
}: {
  label: ReactNode
  path: Path
  options: readonly V[]
}) {
  const { content, set } = useEditor()
  const error = useFieldError(path)
  const chosen = asList(getIn(content, path)).filter(
    (v): v is V => typeof v === 'string',
  )
  const toggle = (v: V) =>
    set(
      path,
      chosen.includes(v)
        ? chosen.filter((x) => x !== v)
        : options.filter((o) => o === v || chosen.includes(o)),
    )
  return (
    <fieldset data-path={toJsonPath(path)} className="scroll-mt-24">
      <legend className="mb-1.5 text-small font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={chosen.includes(o)}
            onClick={() => toggle(o)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-small font-semibold transition-colors ${
              chosen.includes(o)
                ? 'bg-ink text-white'
                : 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-1.5 text-meta font-semibold text-del-ink">{error}</p>
      )}
    </fieldset>
  )
}

/**
 * A list of items (sentences, timeline steps, sources…): one card per item with move and
 * remove buttons, and an add button that appends `newItem()`.
 */
export function ItemList({
  path,
  itemTitle,
  addLabel,
  newItem,
  children,
}: {
  path: Path
  itemTitle: (index: number, item: Record<string, unknown>) => ReactNode
  addLabel: string
  newItem: () => unknown
  children: (
    itemPath: Path,
    index: number,
    item: Record<string, unknown>,
  ) => ReactNode
}) {
  const { content, update } = useEditor()
  const error = useFieldError(path)
  const items = asList(getIn(content, path))
  return (
    <div
      data-path={toJsonPath(path)}
      className="flex scroll-mt-24 flex-col gap-3"
    >
      {error && <p className="text-meta font-semibold text-del-ink">{error}</p>}
      {items.map((item, i) => (
        <div
          key={i}
          data-path={toJsonPath([...path, i])}
          className="scroll-mt-24"
        >
          <ItemCard
            title={itemTitle(i, asObject(item))}
            index={i}
            count={items.length}
            onMove={(delta) => update((doc) => moveIn(doc, path, i, delta))}
            onRemove={() => update((doc) => removeIn(doc, path, i))}
          >
            {children([...path, i], i, asObject(item))}
          </ItemCard>
        </div>
      ))}
      <AddButton
        onClick={() => update((doc) => insertIn(doc, path, newItem()))}
      >
        {addLabel}
      </AddButton>
    </div>
  )
}

/** A short excerpt for an item card title. */
export function excerpt(text: unknown, max = 60): string {
  const s = asText(text)
  if (!s || s === TODO) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}
