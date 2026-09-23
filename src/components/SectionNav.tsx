import { useEffect, useRef, useState } from 'react'
import { copy } from '../copy'
import { scrollBehavior } from '../lib/motion'

export type NavItem = { id: string; label: string }

/**
 * Sticky chip row listing the sections this story has. The section in view is highlighted
 * (IntersectionObserver on a band just below the bar); tapping a chip scrolls to its section.
 */
export default function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id)
  const listRef = useRef<HTMLUListElement>(null)
  const ids = items.map((i) => i.id).join(' ')

  useEffect(() => {
    const order = ids.split(' ')
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
  }, [ids])

  // keep the active chip visible in the scrollable row
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    if (!list || !chip) return
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      behavior: scrollBehavior(),
    })
  }, [active])

  function go(id: string) {
    const section = document.getElementById(id)
    if (!section) return
    section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    setActive(id)
  }

  return (
    <nav
      aria-label={copy.a11y.onThisPage}
      className="sticky top-0 z-30 mt-8 border-b border-line bg-paper"
    >
      <ul
        ref={listRef}
        className="relative mx-auto flex max-w-reading gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    : 'text-muted hover:bg-surface hover:text-ink'
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
