import { adminCopy } from './copy'

type ErrorLike = {
  message?: unknown
  code?: unknown
  details?: unknown
  context?: unknown
}

/**
 * Mongolian text for anything a request can throw: an RPC error ('same_person' → its message),
 * an edge function error ({ error: 'invite_failed' }), a network failure, or anything else.
 */
export async function errorMessage(error: unknown): Promise<string> {
  const e = (error ?? {}) as ErrorLike
  // supabase.functions.invoke: the JSON body of a failed response is in `context`
  if (e.context instanceof Response) {
    try {
      const body = (await e.context.clone().json()) as { error?: string }
      if (body.error && adminCopy.errors.codes[body.error])
        return adminCopy.errors.codes[body.error]
    } catch {
      // not JSON
    }
  }
  const message = typeof e.message === 'string' ? e.message : ''
  if (adminCopy.errors.codes[message]) return adminCopy.errors.codes[message]
  if (
    error instanceof TypeError ||
    /Failed to fetch|NetworkError|Load failed/i.test(message)
  )
    return adminCopy.errors.network
  return message
    ? `${adminCopy.errors.unknown} (${message})`
    : adminCopy.errors.unknown
}

/** The machine code of an RPC error ('version_conflict', 'story_problems', …), if any. */
export function errorCode(error: unknown): string | null {
  const message = (error as ErrorLike | null)?.message
  return typeof message === 'string' && /^[a-z_]+$/.test(message)
    ? message
    : null
}

/** The '<code> <path>' list that publish_story() puts in the error details. */
export function problemList(error: unknown): string[] {
  const details = (error as ErrorLike | null)?.details
  if (typeof details !== 'string') return []
  try {
    const list = JSON.parse(details) as unknown
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}
