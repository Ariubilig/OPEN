import { useSyncExternalStore } from 'react'

// The stories a reader follows, kept in this browser only (no account, no server).
// Storage can be missing or blocked (private mode, previews): the list then lives in memory.
const KEY = 'tod:following'

const listeners = new Set<() => void>()
let cache: string[] | null = null
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

/** Follow when not followed, unfollow when followed. Newest first. */
export function toggled(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]
}

function read(): string[] {
  if (cache) return cache
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
  } catch {
    // storage blocked: start empty
  }
  cache = parseFollowing(raw)
  return cache
}

function notify() {
  for (const listener of listeners) listener()
}

/** Follow or unfollow a story. Returns true when the story is followed afterwards. */
export function toggleFollow(id: string): boolean {
  const next = toggled(read(), id)
  cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: keep the list for this visit only
  }
  notify()
  return next.includes(id)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the list: read it again.
  if (!watchingOtherTabs) {
    watchingOtherTabs = true
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY) return
      cache = null
      notify()
    })
  }
  return () => {
    listeners.delete(listener)
  }
}

const empty: string[] = []

/** Followed story ids, newest first. Re-renders when the list changes (also in other tabs). */
export function useFollowing(): string[] {
  return useSyncExternalStore(subscribe, read, () => empty)
}
