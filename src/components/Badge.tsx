import { useId, useState, type ReactNode } from 'react'
import { copy } from '../copy'
import type { DocType, Stage } from '../data/schema'

// §6: soft background + dark text; the government announcement is outlined.
const TYPE_STYLES: Record<DocType, string> = {
  Хууль: 'bg-type-law-bg text-type-law-ink',
  'Хуулийн төсөл': 'bg-type-bill-bg text-type-bill-ink',
  'УИХ-ын тогтоол': 'bg-type-resolution-bg text-type-resolution-ink',
  'Олон улсын гэрээ': 'bg-type-treaty-bg text-type-treaty-ink',
  'Засгийн газрын тогтоол': 'bg-type-govres-bg text-type-govres-ink',
  Журам: 'bg-type-regulation-bg text-type-regulation-ink',
  'Хөрөнгө оруулалтын төсөл': 'bg-type-investment-bg text-type-investment-ink',
  'Засгийн газрын мэдэгдэл':
    'bg-type-govnote-bg text-type-govnote-ink ring-1 ring-type-govnote-line ring-inset',
}

type BadgeProps = {
  label: string
  hint: string
  className: string
  icon?: ReactNode
}

/**
 * A badge with a short hint: tooltip on hover (devices with a mouse), tap or Enter to reveal.
 * The hint is positioned against the enclosing BadgeRow so it never overflows the screen.
 */
function Badge({ label, hint, className, icon }: BadgeProps) {
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
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-small font-semibold ${className}`}
        >
          {icon}
          {label}
        </span>
      </button>
      <span
        id={hintId}
        role="tooltip"
        className={`absolute top-full left-0 z-20 -mt-1 w-max max-w-full rounded-lg bg-ink px-3 py-2 text-small text-white shadow-md ${
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
      className={TYPE_STYLES[type]}
    />
  )
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge
      label={stage}
      hint={copy.stages.hints[stage]}
      className="bg-surface text-ink ring-1 ring-muted/45 ring-inset"
      icon={
        <span aria-hidden="true" className="size-1.5 rounded-full bg-muted" />
      }
    />
  )
}

/** Type + stage badges. Relative + z-10 so the badges stay tappable above a card's stretched link. */
export function BadgeRow({ type, stage }: { type: DocType; stage: Stage }) {
  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-2">
      <TypeBadge type={type} />
      <StageBadge stage={stage} />
    </div>
  )
}
