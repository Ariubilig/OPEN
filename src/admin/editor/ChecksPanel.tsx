// What stands between the working copy and publishing, with a way to jump to each field.
import type { ReactNode } from 'react'
import type { StoryReport } from '../../lib/validate'
import { adminCopy } from '../copy'
import { findingMessage } from '../validation'
import { SECTIONS } from './sections'

const t = adminCopy.editor.checks

/** `$.meaning[2].source` → "Энэ юу гэсэн үг вэ? · 3". */
export function describePath(path: string): string {
  const m = /^\$\.([A-Za-z]+)(?:\[(\d+)\])?/.exec(path)
  if (!m) return t.whole
  const section = SECTIONS.find((s) => s.keys.includes(m[1]))
  const title = section?.title ?? m[1]
  return m[2] !== undefined ? `${title} · ${Number(m[2]) + 1}` : title
}

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scroll to the field of a JSON path and focus it. A path without its own field (a whole list)
 * falls back to the nearest parent that has one, then to the section.
 */
export function focusPath(path: string): void {
  let p = path
  for (;;) {
    const el = document.querySelector<HTMLElement>(
      `[data-path="${p.replace(/["\\]/g, '\\$&')}"]`,
    )
    if (el) {
      el.scrollIntoView({
        block: 'center',
        behavior: reducedMotion() ? 'auto' : 'smooth',
      })
      const target = el.matches('input, textarea, select, button')
        ? el
        : el.querySelector<HTMLElement>('input, textarea, select, button')
      target?.focus({ preventScroll: true })
      return
    }
    const parent = p.replace(/(\[\d+\]|\.[A-Za-z]+)$/, '')
    if (parent === p || parent === '$' || parent === '') break
    p = parent
  }
  const key = /^\$\.([A-Za-z]+)/.exec(path)?.[1]
  const section = SECTIONS.find((s) => key && s.keys.includes(key))
  document
    .getElementById(`sec-${section?.id ?? 'basics'}`)
    ?.scrollIntoView({
      block: 'start',
      behavior: reducedMotion() ? 'auto' : 'smooth',
    })
}

function Item({
  path,
  children,
  onGo,
}: {
  path: string
  children: ReactNode
  onGo: (path: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onGo(path)}
        className="w-full rounded-lg px-2 py-2 text-left text-small hover:bg-paper"
      >
        <span className="block text-meta font-semibold text-muted">
          {describePath(path)}
        </span>
        <span className="block">{children}</span>
      </button>
    </li>
  )
}

function Group({
  title,
  count,
  children,
  open = false,
}: {
  title: string
  count: number
  children: ReactNode
  open?: boolean
}) {
  if (count === 0) return null
  return (
    <details open={open} className="border-t border-line pt-2">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-small font-bold">
        {title}
        <span className="rounded-full bg-paper px-2 tabular-nums">{count}</span>
      </summary>
      <ul className="-mx-2 flex max-h-[40vh] flex-col overflow-y-auto">
        {children}
      </ul>
    </details>
  )
}

export default function ChecksPanel({
  report,
  onGo,
}: {
  report: StoryReport
  onGo: (path: string) => void
}) {
  const { errors, warnings, todos, notes } = report
  return (
    <section
      aria-labelledby="checks-title"
      className="rounded-card border border-line bg-surface p-4"
    >
      <h2 id="checks-title" className="text-[17px]">
        {t.title}
      </h2>
      <p
        role="status"
        className={`mt-2 rounded-lg px-3 py-2 text-small font-semibold ${
          errors.length ? 'bg-del-bg text-del-ink' : 'bg-ins-bg text-ins-ink'
        }`}
      >
        {errors.length ? t.errors(errors.length) : t.none}
      </p>
      {errors.length > 0 && (
        <ul className="-mx-2 mt-1 flex max-h-[40vh] flex-col overflow-y-auto">
          {errors.map((e, i) => (
            <Item key={i} path={e.path} onGo={onGo}>
              {findingMessage(e)}
            </Item>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-1">
        <Group title={t.warnings} count={warnings.length}>
          {warnings.map((w, i) => (
            <Item key={i} path={w.path} onGo={onGo}>
              {findingMessage(w)}
            </Item>
          ))}
        </Group>
        <Group title={t.todos} count={todos.length}>
          {todos.map((todo, i) => (
            <Item key={i} path={todo.path} onGo={onGo}>
              {todo.message || adminCopy.common.unknownHint}
            </Item>
          ))}
        </Group>
        <Group title={t.notes} count={notes.length}>
          {notes.map((n, i) => (
            <Item key={i} path={n.path} onGo={onGo}>
              {n.message}
            </Item>
          ))}
        </Group>
      </div>
    </section>
  )
}
