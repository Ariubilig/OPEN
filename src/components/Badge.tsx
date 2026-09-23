import { useId, useState, type ReactNode } from 'react'
import { copy } from '../copy'
import type { DocType, Stage } from '../data/schema'
import Icon from './Icon'

// One colour dot per document type; the label itself always stays ink (or white on ink).
const TYPE_DOT: Record<DocType, string> = {
  Хууль: 'bg-type-law',
  'Хуулийн төсөл': 'bg-type-bill',
  'УИХ-ын тогтоол': 'bg-type-resolution',
  'Олон улсын гэрээ': 'bg-type-treaty',
  'Засгийн газрын тогтоол': 'bg-type-govres',
  Журам: 'bg-type-regulation',
  'Хөрөнгө оруулалтын төсөл': 'bg-type-investment',
  'Засгийн газрын мэдэгдэл': 'border-2 border-type-govnote',
}

export function TypeDot({ type }: { type: DocType }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 shrink-0 rounded-[2px] ${TYPE_DOT[type]}`}
    />
  )
}

/** Non-interactive type label: colour dot + name (cards, related stories). */
export function TypeLabel({
  type,
  tone = 'light',
}: {
  type: DocType
  tone?: 'light' | 'dark'
}) {
  return (
    <span
      className={`inline-flex items-center gap-[7px] text-meta font-semibold ${
        tone === 'dark' ? 'text-on-ink' : 'text-ink'
      }`}
    >
      <TypeDot type={type} />
      {type}
    </span>
  )
}

type BadgeProps = {
  label: string
  hint: string
  lead: ReactNode
}

/**
 * A badge with a short hint: tooltip on hover (devices with a mouse), tap or Enter to reveal.
 * The hint is positioned against the enclosing BadgeRow so it never overflows the screen.
 */
function Badge({ label, hint, lead }: BadgeProps) {
  const [open, setOpen] = useState(false)
  const hintId = useId()
  return (
    <span className="group/badge">
      <button
        type="button"
        aria-describedby={hintId}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="inline-flex min-h-11 cursor-help items-center rounded-full"
      >
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface pr-2.5 pl-3 text-small font-semibold text-ink transition-colors group-hover/badge:border-ink">
          {lead}
          {label}
          <Icon name="info" className="size-4 text-muted" />
        </span>
      </button>
      <span
        id={hintId}
        role="tooltip"
        className={`absolute top-full left-0 z-20 -mt-1 w-max max-w-full rounded-xl bg-ink px-3 py-2 text-small text-white shadow-lg ${
          open ? 'block' : 'hidden group-hover/badge:block'
        }`}
      >
        {hint}
      </span>
    </span>
  )
}

export function TypeBadge({ type }: { type: DocType }) {
  return (
    <Badge
      label={type}
      hint={copy.types.hints[type]}
      lead={<TypeDot type={type} />}
    />
  )
}

/** The highlighter dot with an ink ring is the "current step" mark, as in the stage tracker. */
export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge
      label={stage}
      hint={copy.stages.hints[stage]}
      lead={
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full bg-highlight shadow-[inset_0_0_0_2px_var(--ink)]"
        />
      }
    />
  )
}

/** Type + stage badges; relative so the hints can position against the row. */
export function BadgeRow({ type, stage }: { type: DocType; stage: Stage }) {
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-2">
      <TypeBadge type={type} />
      <StageBadge stage={stage} />
    </div>
  )
}
