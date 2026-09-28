// AI draft: staff paste one official document; the ai-draft edge function has Claude write a
// draft story from it in the background. The page lists recent jobs and refreshes while one runs.
import { isAuthApiError } from '@supabase/supabase-js'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useLocation, useRevalidator } from 'react-router'
import { DOC_TYPES, STAGES, type DocType, type Stage } from '../../data/schema'
import { formatDateTime, formatThousands } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { call, supabase } from '../supabase'
import {
  Button,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextArea,
  TextInput,
  useAction,
} from '../ui'

const t = adminCopy.aiDraft
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const POLL_MS = 3000

export async function loader() {
  const [jobs, team] = await Promise.all([
    call(
      supabase
        .from('ai_drafts')
        .select(
          'id, story_id, status, input, document_chars, error, created_by, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(20),
    ),
    call(supabase.from('staff').select('user_id, name')),
  ])
  return { jobs, names: new Map(team.map((m) => [m.user_id, m.name])) }
}

type Data = Awaited<ReturnType<typeof loader>>
/** Router state from the document watcher: a changed page to draft from. */
type DraftFrom = { title: string; url: string; text: string }
type Job = Data['jobs'][number]

/** Why a job failed, in Mongolian: 'anthropic_429: …' → its text; unknown ones keep the detail. */
function failure(error: string | null): string {
  const code = (error ?? '').split(':')[0].trim()
  return (
    t.failures[code] ??
    adminCopy.errors.codes[code] ??
    (error
      ? `${adminCopy.errors.unknown} (${error})`
      : adminCopy.errors.unknown)
  )
}

const STATUS = {
  running: 'bg-accent-soft text-accent-strong',
  done: 'bg-ins-bg text-ins-ink',
  failed: 'bg-del-bg text-del-ink',
} as Record<string, string>

function JobItem({ job, names }: { job: Job; names: Data['names'] }) {
  const title = (job.input as { source?: { title?: string } } | null)?.source
    ?.title
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-small font-semibold">{job.story_id}</p>
          {title && <p className="text-ink-2">{title}</p>}
          <p className="text-meta text-muted tabular-nums">
            {t.meta(
              (job.created_by && names.get(job.created_by)) || '—',
              formatDateTime(job.created_at),
              formatThousands(job.document_chars),
            )}
          </p>
        </div>
        <span
          className={`inline-flex h-7 items-center rounded-full px-3 text-meta font-bold whitespace-nowrap ${STATUS[job.status] ?? ''}`}
        >
          {t.statuses[job.status] ?? job.status}
        </span>
      </div>
      {job.status === 'done' && (
        <Link
          to={`/admin/stories/${job.story_id}`}
          className="inline-flex min-h-11 items-center self-start font-semibold text-accent"
        >
          {t.open}
        </Link>
      )}
      {job.status === 'failed' && (
        <p className="text-small text-del-ink">{failure(job.error)}</p>
      )}
    </li>
  )
}

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const data = useLoaderData() as Data
  const { revalidate } = useRevalidator()
  const from = (useLocation().state as { draftFrom?: DraftFrom } | null)
    ?.draftFrom

  const [id, setId] = useState('')
  const [type, setType] = useState<DocType>('Хуулийн төсөл')
  const [stage, setStage] = useState<Stage>('Өргөн мэдүүлсэн')
  const [sourceTitle, setSourceTitle] = useState(from?.title ?? '')
  const [publisher, setPublisher] = useState('')
  const [url, setUrl] = useState(from?.url ?? '')
  const [publishedAt, setPublishedAt] = useState('')
  const [kind, setKind] = useState<'official' | 'media'>('official')
  const [documentText, setDocumentText] = useState(from?.text ?? '')
  const [instructions, setInstructions] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)
  const start = useAction()
  const idError =
    id && !SLUG.test(id) ? adminCopy.errors.codes.invalid_id : null

  // while a job runs, look again every few seconds (only while the tab is visible)
  const running = data.jobs.some((j) => j.status === 'running')
  useEffect(() => {
    if (!running) return
    const look = () => {
      if (document.visibilityState === 'visible') revalidate()
    }
    const timer = setInterval(look, POLL_MS)
    document.addEventListener('visibilitychange', look)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', look)
    }
  }, [running, revalidate])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!SLUG.test(id)) return
    let started: number | null = null
    const ok = await start.run(async () => {
      // the draft is saved with this session when it is ready: start it with a fresh token
      const refreshed = await supabase.auth.refreshSession()
      // the session is gone (signed out elsewhere, expired): sign in again; the form stays
      if (isAuthApiError(refreshed.error)) throw new Error('unauthorized')
      if (refreshed.error) throw refreshed.error
      const { data: body, error } = await supabase.functions.invoke<{
        jobId: number
      }>('ai-draft', {
        body: {
          storyId: id,
          type,
          stage,
          source: { title: sourceTitle, publisher, url, publishedAt, kind },
          documentText,
          instructions,
        },
      })
      if (error) throw error
      started = body?.jobId ?? null
    })
    if (ok) {
      setJobId(started)
      setId('')
      setDocumentText('')
      setInstructions('')
      revalidate()
    }
  }

  const mine = data.jobs.find((j) => j.id === jobId)

  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <PageHeader title={t.title} />
      <div className="-mt-2 flex flex-col gap-2 text-small text-ink-2">
        <p>{t.intro}</p>
        <p>{t.review}</p>
      </div>
      <Notice tone="warning">{t.privacy}</Notice>

      <Panel title={t.form}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            label={adminCopy.newStory.id}
            hint={adminCopy.newStory.idHint}
            error={idError}
          >
            {(props) => (
              <TextInput
                {...props}
                required
                maxLength={80}
                autoComplete="off"
                spellCheck={false}
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase())}
                className="font-mono"
              />
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={adminCopy.newStory.type}>
              {(props) => (
                <Select
                  {...props}
                  value={type}
                  onChange={(e) => setType(e.target.value as DocType)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={adminCopy.newStory.stage}>
              {(props) => (
                <Select
                  {...props}
                  value={stage}
                  onChange={(e) => setStage(e.target.value as Stage)}
                >
                  {STAGES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t.sourceTitle} hint={t.sourceTitleHint}>
            {(props) => (
              <TextArea
                {...props}
                required
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.publisher}>
              {(props) => (
                <TextInput
                  {...props}
                  required
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                />
              )}
            </Field>
            <Field label={t.kind}>
              {(props) => (
                <Select
                  {...props}
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as 'official' | 'media')
                  }
                >
                  <option value="official">{t.kinds.official}</option>
                  <option value="media">{t.kinds.media}</option>
                </Select>
              )}
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t.url} hint={t.urlHint} optional>
              {(props) => (
                <TextInput
                  {...props}
                  type="url"
                  pattern="https://.+"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}
            </Field>
            <Field label={t.publishedAt} optional>
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label={t.text}
            hint={t.textHint(formatThousands(documentText.trim().length))}
          >
            {(props) => (
              <TextArea
                {...props}
                required
                rows={10}
                minLength={200}
                maxLength={300_000}
                value={documentText}
                onChange={(e) => setDocumentText(e.target.value)}
                className="max-h-[60vh] overflow-y-auto"
              />
            )}
          </Field>
          <Field label={t.instructions} hint={t.instructionsHint} optional>
            {(props) => (
              <TextArea
                {...props}
                maxLength={2000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            )}
          </Field>
          {start.error && <Notice tone="error">{start.error}</Notice>}
          {mine?.status === 'running' && (
            <Notice tone="info">{t.started}</Notice>
          )}
          {mine?.status === 'done' && (
            <Notice tone="success">
              <Link
                to={`/admin/stories/${mine.story_id}`}
                className="font-semibold underline underline-offset-3"
              >
                {t.open}: {mine.story_id}
              </Link>
            </Notice>
          )}
          {mine?.status === 'failed' && (
            <Notice tone="error">{failure(mine.error)}</Notice>
          )}
          <Button
            type="submit"
            variant="primary"
            busy={start.busy}
            className="self-start"
          >
            {t.start}
          </Button>
        </form>
      </Panel>

      <Panel title={t.jobs}>
        {data.jobs.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.jobs.map((job) => (
              <JobItem key={job.id} job={job} names={data.names} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">{t.jobsEmpty}</p>
        )}
      </Panel>
    </div>
  )
}
