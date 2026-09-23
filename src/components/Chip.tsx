import type { ReactNode } from 'react'

/**
 * A single-select chip (feed topics, story group filter, calculator presets).
 * Selected = ink (or the highlighter on dark surfaces), never the highlighter alone on paper.
 * tone "soft" sits on a white card (paper chips instead of white ones).
 */
export default function Chip({
  selected,
  onClick,
  children,
  tone = 'light',
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'light' | 'dark' | 'soft'
}) {
  const colors =
    tone === 'dark'
      ? selected
        ? 'border-highlight bg-highlight text-ink'
        : 'border-ink-border bg-transparent text-on-ink hover:border-on-ink-3'
      : selected
        ? 'border-ink bg-ink text-white'
        : tone === 'soft'
          ? 'border-paper bg-paper text-ink hover:border-ink'
          : 'border-line-strong bg-surface text-ink hover:border-ink'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-small font-semibold whitespace-nowrap tabular-nums transition-colors ${colors}`}
    >
      {children}
    </button>
  )
}
