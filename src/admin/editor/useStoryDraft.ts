// The editor's working state: the document being edited, the last saved version, a copy of
// unsaved edits in this browser (so a closed tab or a crash loses nothing), and saving.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import type { Database, Json } from '../../data/database.types'
import { adminCopy } from '../copy'
import { sameDocument, setIn, type Path } from '../doc'
import { errorCode, errorMessage } from '../errors'
import { call, supabase } from '../supabase'

export type StoryRow = Database['open']['Tables']['stories']['Row']

type Saved = {
  content: unknown
  version: number
  state: StoryRow['state']
  reviewNote: string | null
  updatedBy: string | null
  /** when this browser last saved, for the status line */
  savedAt: Date | null
}

type Backup = { content: unknown; version: number; at: string }

// localStorage can be missing or full (private windows): the backup is a convenience only.
function readBackup(key: string): Backup | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Backup) : null
  } catch {
    return null
  }
}
function writeBackup(key: string, backup: Backup) {
  try {
    localStorage.setItem(key, JSON.stringify(backup))
  } catch {
    // ignore
  }
}
function removeBackup(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function useStoryDraft(row: StoryRow) {
  const key = `tod:draft:${row.id}`
  const [content, setContent] = useState<unknown>(row.content)
  const [saved, setSaved] = useState<Saved>({
    content: row.content,
    version: row.version,
    state: row.state,
    reviewNote: row.review_note,
    updatedBy: row.updated_by,
    savedAt: null,
  })
  const dirty = useMemo(
    () => !sameDocument(content, saved.content),
    [content, saved.content],
  )
  const latest = useRef(content)
  latest.current = content

  const set = useCallback(
    (path: Path, value: unknown) =>
      setContent((prev: unknown) => setIn(prev, path, value)),
    [],
  )
  const update = useCallback(
    (change: (doc: unknown) => unknown) => setContent(change),
    [],
  )

  // ---- the browser copy of unsaved edits ----
  const [backup, setBackup] = useState<Backup | null>(() => {
    const found = readBackup(key)
    return found && !sameDocument(found.content, row.content) ? found : null
  })
  useEffect(() => {
    if (!dirty) {
      // keep an offered backup until the editor decides what to do with it
      if (!backup) removeBackup(key)
      return
    }
    const timer = setTimeout(
      () =>
        writeBackup(key, {
          content: latest.current,
          version: saved.version,
          at: new Date().toISOString(),
        }),
      400,
    )
    return () => clearTimeout(timer)
  }, [key, content, dirty, backup, saved.version])

  const restoreBackup = useCallback(() => {
    if (backup) setContent(backup.content)
    setBackup(null)
  }, [backup])
  const discardBackup = useCallback(() => {
    removeBackup(key)
    setBackup(null)
  }, [key])

  // ---- saving ----
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<{
    message: string
    conflict: boolean
  } | null>(null)

  const save = useCallback(async (): Promise<boolean> => {
    const sent = latest.current
    setSaving(true)
    setSaveError(null)
    try {
      const next = await call(
        supabase.rpc('save_story', {
          p_id: row.id,
          p_content: sent as Json,
          p_version: saved.version,
        }),
      )
      setSaved({
        content: sent,
        version: next.version,
        state: next.state,
        reviewNote: next.review_note,
        updatedBy: next.updated_by,
        savedAt: new Date(),
      })
      return true
    } catch (e) {
      setSaveError({
        message: await errorMessage(e),
        conflict: errorCode(e) === 'version_conflict',
      })
      return false
    } finally {
      setSaving(false)
    }
  }, [row.id, saved.version])

  /** After a workflow step (submit, request changes…): the row the server returned. */
  const applyRow = useCallback((next: StoryRow) => {
    setSaved((prev) => ({
      ...prev,
      version: next.version,
      state: next.state,
      reviewNote: next.review_note,
      updatedBy: next.updated_by,
    }))
  }, [])

  // ---- leaving with unsaved edits ----
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(adminCopy.editor.leaveConfirm)) blocker.proceed()
    else blocker.reset()
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return {
    content,
    set,
    update,
    saved,
    dirty,
    save,
    saving,
    saveError,
    applyRow,
    backup,
    backupIsStale: backup !== null && backup.version !== saved.version,
    restoreBackup,
    discardBackup,
  }
}
