import type { ReactNode } from 'react'

/** A single-select filter chip (feed filters, story group filter). */
export default function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small font-semibold whitespace-nowrap transition-colors ${
        selected
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}
