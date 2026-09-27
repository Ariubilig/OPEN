// Comparing a working copy with what is live: both as readers get them (no reviewer notes),
// pretty-printed with sorted keys, diffed line by line.
import { diffLines } from 'diff'

/** The document without reviewer notes (`verify`) or the `draft` flag, like publish_story(). */
export function publicView(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicView)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== 'verify' && k !== 'draft')
        .map(([k, v]) => [k, publicView(v)]),
    )
  return value
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    )
  return value
}

/** Pretty JSON with sorted keys, so key order never shows up as a change. */
export function prettyJson(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`
}

export type Block = { kind: 'same' | 'added' | 'removed'; lines: string[] }

export function lineDiff(before: string, after: string): Block[] {
  return diffLines(before, after).map((part) => ({
    kind: part.added ? 'added' : part.removed ? 'removed' : 'same',
    lines: part.value.replace(/\n$/, '').split('\n'),
  }))
}
