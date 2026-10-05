import { useSyncExternalStore } from 'react'
import type { Story } from '../data/schema'
import { stageSummary } from './timeline'

// The stories a reader follows, kept in this browser only (no account, no server), and where each
// followed document was when the reader last saw it ("Шат өөрчлөгдсөн" in the follow list).
// Storage can be missing or blocked (private mode, previews): the lists then live in memory.
const KEY = 'tod:following'
const SEEN_KEY = 'tod:seen'

/** Where a document is: its stage and the step marked current. */
export type Snapshot = { stage: string; step: string }

const listeners = new Set<() => void>()
let cache: string[] | null = null
let seenCache: Record<string, Snapshot> | null = null
let watchingOtherTabs = false

/** Story ids from the stored JSON; anything malformed counts as an empty list. */
export function parseFollowing(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((x): x is string => typeof x === 'string'))]
  } catch {
    return []
  }
}

/** The stored snapshots by story id; malformed entries are left out. */
export function parseSeen(raw: string | null): Record<string, Snapshot> {
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const seen: Record<string, Snapshot> = {}
    for (const [id, s] of Object.entries(value)) {
      const { stage, step } = (s ?? {}) as Partial<Snapshot>
      if (typeof stage === 'string' && typeof step === 'string')
        seen[id] = { stage, step }
    }
    return seen
  } catch {
    return {}
  }
}

/** Follow when not followed, unfollow when followed. Newest first. */
export function toggled(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]
}

/** Where a story is now (feed cards and full stories both have stage and timeline). */
export function snapshotOf(story: Pick<Story, 'stage' | 'timeline'>): Snapshot {
  return {
    stage: story.stage,
    step: stageSummary(story.timeline).current?.label ?? '',
  }
}

/** The snapshot the reader last saw when the document has moved since; null when it has not. */
export function changedSince(
  seen: Snapshot | undefined,
  now: Snapshot,
): Snapshot | null {
  if (!seen) return null
  return seen.stage !== now.stage || seen.step !== now.step ? seen : null
}

function load<T>(key: string, parse: (raw: string | null) => T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    // storage blocked: start empty
  }
  return parse(raw)
}

function store(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage blocked: keep the value for this visit only
  }
}

function read(): string[] {
  return (cache ??= load(KEY, parseFollowing))
}

function readSeen(): Record<string, Snapshot> {
  return (seenCache ??= load(SEEN_KEY, parseSeen))
}

function notify() {
  for (const listener of listeners) listener()
}

/** Follow or unfollow a story. Returns true when the story is followed afterwards. */
export function toggleFollow(id: string): boolean {
  const next = toggled(read(), id)
  cache = next
  store(KEY, next)
  const followed = next.includes(id)
  if (!followed && id in readSeen()) {
    const rest = { ...readSeen() }
    delete rest[id]
    seenCache = rest
    store(SEEN_KEY, rest)
  }
  notify()
  return followed
}

/** Remember where a followed story is now, as the reader has seen it. */
export function markSeen(id: string, snapshot: Snapshot) {
  const seen = readSeen()
  const before = seen[id]
  if (before && !changedSince(before, snapshot)) return
  seenCache = { ...seen, [id]: snapshot }
  store(SEEN_KEY, seenCache)
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed a list: read it again.
  if (!watchingOtherTabs) {
    watchingOtherTabs = true
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) cache = null
      else if (e.key === SEEN_KEY) seenCache = null
      else return
      notify()
    })
  }
  return () => {
    listeners.delete(listener)
  }
}

const empty: string[] = []
const emptySeen: Record<string, Snapshot> = {}

/** Followed story ids, newest first. Re-renders when the list changes (also in other tabs). */
export function useFollowing(): string[] {
  return useSyncExternalStore(subscribe, read, () => empty)
}

/** Where each followed story was when the reader last saw it. */
export function useSeen(): Record<string, Snapshot> {
  return useSyncExternalStore(subscribe, readSeen, () => emptySeen)
}
