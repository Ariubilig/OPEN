import { useEffect, useRef, useState } from 'react'
import { copy } from '../copy'
import { scrollBehavior } from '../lib/motion'

export type NavItem = { id: string; label: string }

/** Scroll to a story section and move focus to its heading (section nav, stage card, CTA). */
export function goToSection(id: string) {
  const section = document.getElementById(id)
  if (!section) return
  section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
  section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
}

/** The section in view: IntersectionObserver on a band just below the top of the screen. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join(' ')
  useEffect(() => {
    const order = key.split(' ')
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        const first = order.find((id) => visible.has(id))
        if (first) setActive(first)
      },
      { rootMargin: '-72px 0px -55% 0px' },
    )
    for (const id of order) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key])
  return [active, setActive] as const
}

/**
 * The sections this story has, with the one in view highlighted.
 * "bar": sticky chip row under the story header (phones, tablets).
 * "list": numbered list in the right rail (wide screens).
 */
export default function SectionNav({
  items,
  variant = 'bar',
  className = '',
}: {
  items: NavItem[]
  variant?: 'bar' | 'list'
  className?: string
}) {
  const [active, setActive] = useActiveSection(items.map((i) => i.id))
  const listRef = useRef<HTMLUListElement>(null)

  // keep the active chip visible in the scrollable row
  useEffect(() => {
    if (variant !== 'bar') return
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    if (!list || !chip) return
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      behavior: scrollBehavior(),
    })
  }, [active, variant])

  function go(id: string) {
    goToSection(id)
    setActive(id)
  }

  if (variant === 'list') {
    return (
      <nav
        aria-label={copy.a11y.onThisPage}
        className={`flex flex-col gap-1.5 rounded-card border border-line bg-surface px-2.5 pt-3.5 pb-2.5 ${className}`}
      >
        <p aria-hidden="true" className="eyebrow px-3 text-muted">
          {copy.a11y.onThisPage}
        </p>
        <ul className="flex flex-col gap-0.5">
          {items.map((item, i) => {
            const isActive = item.id === active
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    go(item.id)
                  }}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
                    isActive
                      ? 'bg-ink font-bold text-white'
                      : 'font-medium text-ink hover:bg-paper'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-[22px] text-overline font-extrabold tabular-nums ${
                      isActive ? 'text-highlight' : 'text-muted'
                    }`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return (
    <nav
      aria-label={copy.a11y.onThisPage}
      className={`sticky top-0 z-30 -mx-4 mt-7 border-y border-line bg-paper md:mx-0 ${className}`}
    >
      <ul
        ref={listRef}
        className="relative flex gap-0.5 overflow-x-auto px-2.5 py-1.5 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.id === active
          return (
            <li key={item.id} data-id={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  go(item.id)
                }}
                className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-small font-semibold whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'bg-ink text-white'
                    : 'text-ink-2 hover:bg-surface hover:text-ink'
                }`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
