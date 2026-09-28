// Document watcher: official pages checked daily by the watch-documents function. Changes come
// first (a line diff of the page text; editors mark them seen), then the watched pages.
import { useMemo, useState, type FormEvent } from 'react'
import {
  Link,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import Icon from '../../components/Icon'
import { formatDateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { lineDiff } from '../editor/compare'
import { LineDiff } from '../editor/DiffView'
import { call, supabase } from '../supabase'
import {
  Button,
  Checkbox,
  Field,
  Notice,
  PageHeader,
  Panel,
  Select,
  TextInput,
  useAction,
} from '../ui'

const t = adminCopy.watch

export async function loader() {
  const [documents, events, stories, team] = await Promise.all([
    call(
      supabase
        .from('watched_documents')
        .select(
          'id, url, label, story_id, active, last_checked_at, last_changed_at, last_status, last_error',
        )
        .order('label'),
    ),
    call(
      supabase
        .from('watch_events')
        .select('id, document_id, detected_at, seen_at, seen_by')
        .order('detected_at', { ascending: false })
        .limit(200),
    ),
    call(supabase.from('story_admin_list').select('id, title').order('id')),
    call(supabase.from('staff').select('user_id, name')),
  ])
  return {
    documents,
    events,
    stories,
    byId: new Map(documents.map((d) => [d.id, d])),
    names: new Map(team.map((m) => [m.user_id, m.name])),
  }
}

type Data = Awaited<ReturnType<typeof loader>>
type Doc = Data['documents'][number]
type WatchEvent = Data['events'][number]
type RunResult = { checked: number; changed: number; errors: number }

/** Ask the watch-documents function to check now: pages due in 6 hours, or the pages `ids`. */
async function runCheck(ids?: number[]): Promise<RunResult> {
  const { data, error } = await supabase.functions.invoke<RunResult>(
    'watch-documents',
    { body: ids ? { ids } : {} },
  )
  if (error) throw error
  return data ?? { checked: 0, changed: 0, errors: 0 }
}

function fetchError(error: string | null): string {
  if (!error) return ''
  const http = /^http_(\d+)$/.exec(error)
  return http ? t.httpError(http[1]) : (t.fetchErrors[error] ?? error)
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent"
    >
      {children}
      <Icon name="externalLink" className="size-3.5" />
    </a>
  )
}

// ---- changes -------------------------------------------------------------------------------------

function EventCard({ event, data }: { event: WatchEvent; data: Data }) {
  const { revalidate } = useRevalidator()
  const navigate = useNavigate()
  const doc = data.byId.get(event.document_id)
  const [texts, setTexts] = useState<{
    old_text: string | null
    new_text: string | null
  } | null>(null)
  const [open, setOpen] = useState(false)
  const load = useAction()
  const seen = useAction()
  // every line ends in a newline, or the last line of one side never matches the other's
  const blocks = useMemo(
    () =>
      texts?.new_text != null
        ? lineDiff(
            texts.old_text == null ? '' : texts.old_text + '\n',
            texts.new_text + '\n',
          )
        : null,
    [texts],
  )

  async function toggle() {
    if (!open && !texts)
      await load.run(async () =>
        setTexts(
          await call(
            supabase
              .from('watch_events')
              .select('old_text, new_text')
              .eq('id', event.id)
              .single(),
          ),
        ),
      )
    setOpen(!open)
  }

  async function markSeen() {
    if (
      await seen.run(() =>
        call(supabase.rpc('mark_watch_events_seen', { p_ids: [event.id] })),
      )
    )
      revalidate()
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{doc?.label ?? event.document_id}</p>
          <p className="text-meta text-muted tabular-nums">
            {formatDateTime(event.detected_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-small">
          {doc && <ExternalLink href={doc.url}>{t.openPage}</ExternalLink>}
          {doc?.story_id && (
            <Link
              to={`/admin/stories/${doc.story_id}`}
              className="inline-flex min-h-11 items-center font-semibold text-accent"
            >
              {t.openStory}
            </Link>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button busy={load.busy} aria-expanded={open} onClick={toggle}>
          {open ? t.hide : t.show}
        </Button>
        {event.seen_at ? (
          <p className="flex min-h-11 items-center text-small text-ink-2">
            {t.seenBy(
              (event.seen_by && data.names.get(event.seen_by)) || '—',
              formatDateTime(event.seen_at),
            )}
          </p>
        ) : (
          <Button variant="primary" busy={seen.busy} onClick={markSeen}>
            {t.markSeen}
          </Button>
        )}
      </div>
      {load.error && <Notice tone="error">{load.error}</Notice>}
      {seen.error && <Notice tone="error">{seen.error}</Notice>}
      {open && texts && (
        <div className="flex flex-col gap-3">
          {blocks ? (
            <>
              {texts.old_text == null && (
                <p className="text-small text-ink-2">{t.firstText}</p>
              )}
              <LineDiff blocks={blocks} />
              {doc && (
                <Button
                  className="self-start"
                  onClick={() =>
                    navigate('/admin/ai', {
                      state: {
                        draftFrom: {
                          title: doc.label,
                          url: doc.url,
                          text: texts.new_text,
                        },
                      },
                    })
                  }
                >
                  {t.toDraft}
                </Button>
              )}
            </>
          ) : (
            <Notice>{t.notText}</Notice>
          )}
        </div>
      )}
    </li>
  )
}

function Changes({ data }: { data: Data }) {
  const { revalidate } = useRevalidator()
  const [params, setParams] = useSearchParams()
  const showSeen = params.get('changes') === 'seen'
  const unseen = data.events.filter((e) => !e.seen_at)
  const shown = showSeen ? data.events.filter((e) => e.seen_at) : unseen
  const all = useAction()

  async function markAll() {
    if (
      await all.run(() =>
        call(
          supabase.rpc('mark_watch_events_seen', {
            p_ids: unseen.map((e) => e.id),
          }),
        ),
      )
    )
      revalidate()
  }

  const tab = (seen: boolean, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={showSeen === seen}
      onClick={() => setParams(seen ? { changes: 'seen' } : {})}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-semibold ${
        showSeen === seen
          ? 'bg-ink text-white'
          : 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]'
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${showSeen === seen ? 'text-highlight' : 'text-muted'}`}
      >
        {count}
      </span>
    </button>
  )

  return (
    <Panel title={t.changes}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label={t.filters} className="flex gap-2">
            {tab(false, t.unseen, unseen.length)}
            {tab(true, t.seen, data.events.length - unseen.length)}
          </div>
          {!showSeen && unseen.length > 1 && (
            <Button busy={all.busy} onClick={markAll}>
              {t.markAllSeen}
            </Button>
          )}
        </div>
        {all.error && <Notice tone="error">{all.error}</Notice>}
        {shown.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {shown.map((event) => (
              <EventCard key={event.id} event={event} data={data} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">{t.noChanges}</p>
        )}
      </div>
    </Panel>
  )
}

// ---- watched pages -------------------------------------------------------------------------------

function StorySelect({
  value,
  onChange,
  stories,
}: {
  value: string
  onChange: (id: string) => void
  stories: Data['stories']
}) {
  return (
    <Field label={t.story} optional>
      {(props) => (
        <Select
          {...props}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t.noStory}</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id ?? ''}>
              {s.id} · {s.title}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

function DocumentItem({ doc, data }: { doc: Doc; data: Data }) {
  const { revalidate } = useRevalidator()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(doc.label)
  const [storyId, setStoryId] = useState(doc.story_id ?? '')
  const [active, setActive] = useState(doc.active)
  const [text, setText] = useState<string | null | undefined>(undefined)
  const action = useAction()
  const story = data.stories.find((s) => s.id === doc.story_id)

  async function check() {
    if (await action.run(() => runCheck([doc.id]))) {
      setText(undefined)
      revalidate()
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (
      await action.run(() =>
        call(
          supabase.rpc('update_watched_document', {
            p_id: doc.id,
            p_label: label,
            p_story_id: storyId,
            p_active: active,
          }),
        ),
      )
    ) {
      setEditing(false)
      revalidate()
    }
  }

  async function remove() {
    if (!window.confirm(t.removeConfirm)) return
    if (
      await action.run(() =>
        call(supabase.rpc('remove_watched_document', { p_id: doc.id })),
      )
    )
      revalidate()
  }

  async function loadText(open: boolean) {
    if (!open || text !== undefined) return
    await action.run(async () => {
      const row = await call(
        supabase
          .from('watched_documents')
          .select('last_text')
          .eq('id', doc.id)
          .single(),
      )
      setText(row.last_text)
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">
            {doc.label}
            {!doc.active && (
              <span className="ml-2 inline-flex h-6 items-center rounded-full bg-paper px-2.5 align-middle text-meta font-bold shadow-[inset_0_0_0_1px_var(--line-strong)]">
                {t.paused}
              </span>
            )}
          </p>
          <p className="text-meta break-all text-muted">{doc.url}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-small">
          <ExternalLink href={doc.url}>{t.openPage}</ExternalLink>
          {story && (
            <Link
              to={`/admin/stories/${story.id}`}
              className="inline-flex min-h-11 items-center font-semibold text-accent"
            >
              {story.id}
            </Link>
          )}
        </div>
      </div>
      <p className="text-small text-ink-2 tabular-nums">
        {doc.last_checked_at
          ? `${t.statuses[doc.last_status ?? ''] ?? ''} · ${t.checked(formatDateTime(doc.last_checked_at))}`
          : t.neverChecked}
        {doc.last_changed_at &&
          ` · ${t.changedAt(formatDateTime(doc.last_changed_at))}`}
      </p>
      {doc.last_status === 'error' && (
        <p className="text-small text-del-ink">{fetchError(doc.last_error)}</p>
      )}
      <details
        onToggle={(e) => loadText(e.currentTarget.open)}
        className="text-small"
      >
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
          {t.lastText}
        </summary>
        {text !== undefined && (
          <pre className="max-h-80 overflow-auto rounded-xl bg-paper p-3 font-sans text-small whitespace-pre-wrap">
            {text || t.noText}
          </pre>
        )}
      </details>
      {editing ? (
        <form
          onSubmit={save}
          className="flex flex-col gap-3 border-t border-line pt-3"
        >
          <Field label={t.label}>
            {(props) => (
              <TextInput
                {...props}
                required
                maxLength={200}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <StorySelect
            value={storyId}
            onChange={setStoryId}
            stories={data.stories}
          />
          <Checkbox
            label={t.active}
            hint={t.activeHint}
            checked={active}
            onChange={setActive}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" busy={action.busy}>
              {adminCopy.common.save}
            </Button>
            <Button
              onClick={() => {
                setLabel(doc.label)
                setStoryId(doc.story_id ?? '')
                setActive(doc.active)
                setEditing(false)
              }}
            >
              {adminCopy.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button busy={action.busy} onClick={check}>
            {t.check}
          </Button>
          <Button onClick={() => setEditing(true)}>{t.edit}</Button>
          <Button variant="danger" busy={action.busy} onClick={remove}>
            {t.remove}
          </Button>
        </div>
      )}
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </li>
  )
}

function AddDocument({ data }: { data: Data }) {
  const { revalidate } = useRevalidator()
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [storyId, setStoryId] = useState('')
  const [done, setDone] = useState(false)
  const add = useAction()

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(false)
    const ok = await add.run(async () => {
      const doc = await call(
        supabase.rpc('add_watched_document', {
          p_url: url,
          p_label: label,
          p_story_id: storyId,
        }),
      )
      // read it at once: the first text is the baseline later checks compare with
      await runCheck([doc.id])
    })
    if (ok) {
      setDone(true)
      setUrl('')
      setLabel('')
      setStoryId('')
    }
    revalidate()
  }

  return (
    <Panel title={t.add} intro={t.addIntro}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t.url} hint={t.urlHint}>
          {(props) => (
            <TextInput
              {...props}
              required
              type="url"
              pattern="https://.+"
              maxLength={2000}
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t.label} hint={t.labelHint}>
            {(props) => (
              <TextInput
                {...props}
                required
                maxLength={200}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            )}
          </Field>
          <StorySelect
            value={storyId}
            onChange={setStoryId}
            stories={data.stories}
          />
        </div>
        {add.error && <Notice tone="error">{add.error}</Notice>}
        {done && <Notice tone="success">{t.added}</Notice>}
        <Button
          type="submit"
          variant="primary"
          busy={add.busy}
          className="self-start"
        >
          {t.add}
        </Button>
      </form>
    </Panel>
  )
}

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const data = useLoaderData() as Data
  const { revalidate } = useRevalidator()
  const [result, setResult] = useState<RunResult | null>(null)
  const run = useAction()

  async function checkNow() {
    setResult(null)
    let outcome: RunResult | null = null
    if (await run.run(async () => (outcome = await runCheck()))) {
      setResult(outcome)
      revalidate()
    }
  }

  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <PageHeader title={t.title}>
        <Button variant="primary" busy={run.busy} onClick={checkNow}>
          {t.checkNow}
        </Button>
      </PageHeader>
      <div className="-mt-2 flex flex-col gap-2 text-small text-ink-2">
        <p>
          {t.intro} {t.checkNowHint}
        </p>
        <p>{t.jsNote}</p>
      </div>
      {run.error && <Notice tone="error">{run.error}</Notice>}
      {result && (
        <Notice tone={result.errors > 0 ? 'warning' : 'success'}>
          {result.checked > 0
            ? t.ran(result.checked, result.changed, result.errors)
            : t.nothingDue}
        </Notice>
      )}

      <Changes data={data} />

      <Panel title={t.documents}>
        {data.documents.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {data.documents.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} data={data} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">{t.noDocuments}</p>
        )}
      </Panel>

      <AddDocument data={data} />
    </div>
  )
}
