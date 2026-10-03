// "Түүх": every revision of the story with who, when, what and why; any revision can be viewed
// as the story page and restored as the working copy.
import { useEffect, useState } from 'react'
import type { Json } from '../../data/database.types'
import { formatDateTime } from '../../lib/format'
import { adminCopy } from '../copy'
import { errorMessage } from '../errors'
import { call, maybe, supabase } from '../supabase'
import StoryPreview from '../StoryPreview'
import { Button, Notice, useAction } from '../ui'

const t = adminCopy.history

export type Revision = {
  id: number
  action: string
  note: string | null
  author: string | null
  created_at: string
}

/** The newest revisions of a story, newest first. */
function fetchRevisions(storyId: string): Promise<Revision[]> {
  return call(
    supabase
      .from('story_revisions')
      .select('id, action, note, author, created_at')
      .eq('story_id', storyId)
      .order('id', { ascending: false })
      .limit(200),
  )
}

function RevisionItem({
  revision,
  authorName,
  current,
  canRestore,
  onRestore,
}: {
  revision: Revision
  authorName: string
  current: boolean
  canRestore: boolean
  onRestore: (id: number) => void
}) {
  const [content, setContent] = useState<Json | null>(null)
  const load = useAction()

  async function toggle() {
    if (content !== null) return setContent(null)
    await load.run(async () => {
      const row = await maybe(
        supabase
          .from('story_revisions')
          .select('content')
          .eq('id', revision.id)
          .maybeSingle(),
      )
      setContent(row?.content ?? null)
    })
  }

  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {t.actions[revision.action] ?? revision.action}{' '}
            <span className="font-normal text-muted">#{revision.id}</span>
            {current && (
              <span className="ml-2 rounded-full bg-paper px-2 text-meta font-semibold">
                {t.current}
              </span>
            )}
          </p>
          <p className="text-meta text-muted tabular-nums">
            {formatDateTime(revision.created_at)} · {authorName}
          </p>
          {revision.note && (
            <p className="mt-1 text-small whitespace-pre-wrap">
              {revision.note}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={toggle} busy={load.busy}>
            {content !== null ? t.hide : t.view}
          </Button>
          {canRestore && (
            <Button
              onClick={() =>
                window.confirm(t.restoreConfirm) && onRestore(revision.id)
              }
            >
              {t.restore}
            </Button>
          )}
        </div>
      </div>
      {load.error && <Notice tone="error">{load.error}</Notice>}
      {content !== null && <StoryPreview content={content} />}
    </li>
  )
}

export default function HistoryView({
  storyId,
  names,
  version,
  dirty,
  onRestored,
}: {
  storyId: string
  /** user id → name */
  names: ReadonlyMap<string, string>
  /** the saved version: the list reloads whenever it changes */
  version: number
  dirty: boolean
  onRestored: () => void
}) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const restore = useAction()

  useEffect(() => {
    let cancelled = false
    fetchRevisions(storyId).then(
      (list) => !cancelled && setRevisions(list),
      async (e) => !cancelled && setLoadError(await errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [storyId, version])

  async function restoreRevision(id: number) {
    if (
      await restore.run(() =>
        call(
          supabase.rpc('restore_revision', {
            p_revision_id: id,
            p_version: version,
          }),
        ),
      )
    )
      onRestored()
  }

  if (loadError) return <Notice tone="error">{loadError}</Notice>
  if (!revisions)
    return <p className="text-muted">{adminCopy.common.loading}</p>
  if (revisions.length === 0) return <Notice>{t.empty}</Notice>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">{t.intro}</p>
      {dirty && <Notice tone="warning">{adminCopy.workflow.saveFirst}</Notice>}
      {restore.error && <Notice tone="error">{restore.error}</Notice>}
      <ol className="rounded-card border border-line bg-surface px-4">
        {revisions.map((r, i) => (
          <RevisionItem
            key={r.id}
            revision={r}
            authorName={(r.author && names.get(r.author)) || t.system}
            // every save and step writes a revision: the newest one is the saved working copy
            current={i === 0}
            canRestore={!dirty && i > 0}
            onRestore={restoreRevision}
          />
        ))}
      </ol>
    </div>
  )
}
