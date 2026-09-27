// What every editor section needs: the working copy (possibly half-filled), a way to change it,
// and the lists its selects offer (sources, channels, other stories).
import { createContext, useContext } from 'react'
import type { Channel } from '../../data/schema'
import type { Path } from '../doc'

export type StoryOption = { id: string; title: string; isLive: boolean }

export type EditorApi = {
  /** the working copy as it is being edited; it may not match the schema yet */
  content: unknown
  set: (path: Path, value: unknown) => void
  update: (change: (content: unknown) => unknown) => void
  channels: Channel[]
  /** every other story, for related-story links */
  stories: StoryOption[]
}

export const EditorContext = createContext<EditorApi | null>(null)

export function useEditor(): EditorApi {
  const api = useContext(EditorContext)
  if (!api) throw new Error('useEditor() needs an <EditorContext.Provider>')
  return api
}

// ---- reading a half-filled document safely -----------------------------------------------------

export const asText = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : undefined

export const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

export const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}

export const asNumber = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : undefined

/** The story's sources as select options: id and title. */
export function sourceOptions(
  content: unknown,
): { id: string; title: string }[] {
  return asList(asObject(content).sources).flatMap((s) => {
    const id = asText(asObject(s).id)
    return id ? [{ id, title: asText(asObject(s).title) ?? '' }] : []
  })
}
