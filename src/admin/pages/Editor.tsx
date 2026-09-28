// The story editor: every part of a story as a form, live checks against the publishing rules,
// a preview that is the real story page, the review and publishing steps, the changes against
// what is live, and the full history.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
  type LoaderFunctionArgs,
  type ShouldRevalidateFunction,
} from 'react-router'
import DataText from '../../components/DataText'
import Icon from '../../components/Icon'
import { clearCache } from '../../data/api'
import { useSite } from '../../data/site'
import { formatDateTime, today } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { validateStory } from '../../lib/validate'
import { adminCopy } from '../copy'
import ChecksPanel, { focusPath } from '../editor/ChecksPanel'
import {
  EditorContext,
  asObject,
  asText,
  type EditorApi,
} from '../editor/context'
import DiffView from '../editor/DiffView'
import { asPublished, downloadJson } from '../editor/documents'
import HistoryView, { fetchRevisions } from '../editor/HistoryView'
import { SECTION_COMPONENTS, SECTIONS } from '../editor/sections'
import { useStoryDraft, type StoryRow } from '../editor/useStoryDraft'
import Workflow, { type WorkflowDone } from '../editor/Workflow'
import { ErrorsProvider } from '../fields'
import { useStaff } from '../session'
import StoryPreview from '../StoryPreview'
import { call, hasRole, maybe, supabase } from '../supabase'
import { Button, Notice, StateBadge, useAction } from '../ui'
import { findingsByPath } from '../validation'

const t = adminCopy.editor

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id ?? ''
  const [story, list, live, revisions, team, settings, followers] =
    await Promise.all([
      maybe(supabase.from('stories').select('*').eq('id', id).maybeSingle()),
      call(
        supabase
          .from('story_admin_list')
          .select('id, title, is_live')
          .order('updated_at', { ascending: false }),
      ),
      maybe(
        supabase
          .from('published_stories')
          .select('content')
          .eq('id', id)
          .maybeSingle(),
      ),
      fetchRevisions(id),
      call(supabase.from('staff').select('user_id, name')),
      call(
        supabase.from('settings').select('require_two_person_review').single(),
      ),
      call(supabase.rpc('follower_count', { p_story_id: id })),
    ])
  if (!story) throw new Error('not_found')
  return {
    story: story as StoryRow,
    stories: list.map((s) => ({
      id: s.id ?? '',
      title: s.title ?? s.id ?? '',
      isLive: s.is_live ?? false,
    })),
    live: live?.content ?? null,
    // a correction line is only for stories that were published before
    wasPublished: revisions.some((r) => r.action === 'publish'),
    names: new Map(team.map((m) => [m.user_id, m.name])),
    twoPersonRule: settings.require_two_person_review,
    followers,
  }
}

type Data = Awaited<ReturnType<typeof loader>>

// Switching tabs (?tab=) is not a reason to reload the story; an explicit revalidate() is.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname !== nextUrl.pathname ||
  currentUrl.search === nextUrl.search
    ? defaultShouldRevalidate
    : false

const TABS = ['edit', 'preview', 'diff', 'history'] as const
type Tab = (typeof TABS)[number]

function Tabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: [Tab, string][] = [
    ['edit', t.tabs.edit],
    ['preview', t.tabs.preview],
    ['diff', t.tabs.diff],
    ['history', t.tabs.history],
  ]
  return (
    <div
      role="tablist"
      aria-label={t.tabs.label}
      className="flex gap-1 border-b border-line"
    >
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
          className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-small font-semibold ${
            tab === id
              ? 'border-ink text-ink'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SaveStatus({
  dirty,
  saving,
  savedAt,
}: {
  dirty: boolean
  saving: boolean
  savedAt: Date | null
}) {
  const text = saving
    ? t.saving
    : dirty
      ? t.unsaved
      : savedAt
        ? t.savedAt(formatDateTime(savedAt).slice(11))
        : t.upToDate
  return (
    <p
      role="status"
      className={`text-meta font-semibold ${dirty ? 'text-placeholder-ink' : 'text-muted'}`}
    >
      {text}
    </p>
  )
}

function EditorBody({
  story,
  stories,
  live: liveContent,
  wasPublished,
  names,
  twoPersonRule,
  followers,
}: Data) {
  const staff = useStaff()
  const { channels } = useSite()
  const navigate = useNavigate()
  const { revalidate } = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((x) => x === params.get('tab')) ?? 'edit'
  const draft = useStoryDraft(story)
  const { content, dirty, save, saving } = draft
  const title = asText(asObject(content).title) ?? story.id
  useDocumentTitle(`${title} · ${adminCopy.title}`)

  // Ctrl+S / ⌘S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!saving) void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, saving])

  // checked as it will be published (publishedAt is filled then)
  const report = useMemo(
    () =>
      validateStory(asPublished(content, today()), {
        storyIds: new Set(stories.map((s) => s.id)),
        channelIds: new Set(channels.map((c) => c.id)),
      }),
    [content, stories, channels],
  )
  const errors = useMemo(() => findingsByPath(report.errors), [report])

  const api = useMemo<EditorApi>(
    () => ({
      content,
      set: draft.set,
      update: draft.update,
      channels,
      stories: stories.filter((s) => s.id !== story.id),
    }),
    [content, draft.set, draft.update, channels, stories, story.id],
  )

  const live = liveContent !== null
  const remove = useAction()

  // After a workflow step or a restore: load the story again (a fresh editor), say what happened.
  const location = useLocation()
  const done = (location.state as { done?: WorkflowDone } | null)?.done
  const afterStep = (step: WorkflowDone) => {
    clearCache()
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: { done: step } },
    )
  }
  async function deleteStory() {
    if (!window.confirm(t.deleteConfirm)) return
    if (
      await remove.run(() =>
        call(supabase.rpc('delete_story', { p_id: story.id })),
      )
    )
      navigate('/admin', { replace: true })
  }

  const setTab = (next: Tab) =>
    setParams(next === 'edit' ? {} : { tab: next }, { replace: true })
  // jump to a field from the checks panel: once the edit tab has rendered
  const [target, setTarget] = useState<{ path: string } | null>(null)
  useEffect(() => {
    if (target && tab === 'edit') {
      focusPath(target.path)
      setTarget(null)
    }
  }, [target, tab])
  const goTo = (path: string) => {
    if (tab !== 'edit') setTab('edit')
    setTarget({ path })
  }

  let notice: ReactNode = null
  if (draft.backup)
    notice = (
      <Notice tone="warning">
        <p className="font-semibold">{t.restore.title}</p>
        <p>
          {t.restore.text} ({formatDateTime(draft.backup.at)})
          {draft.backupIsStale && ` ${t.restore.stale}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="primary" onClick={draft.restoreBackup}>
            {t.restore.restore}
          </Button>
          <Button onClick={draft.discardBackup}>{t.restore.discard}</Button>
        </div>
      </Notice>
    )

  return (
    <EditorContext.Provider value={api}>
      <div className="flex flex-col gap-4">
        <Link
          to="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-small font-semibold text-accent"
        >
          <Icon name="arrowLeft" className="size-4" />
          {t.back}
        </Link>

        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-h2 text-pretty lg:text-h2-lg">
              <DataText value={title} />
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StateBadge state={draft.saved.state} />
              {followers > 0 && (
                <span className="text-meta font-semibold text-muted">
                  {t.followers(followers)}
                </span>
              )}
              {live && (
                <a
                  href={`/story/${story.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 px-2 text-meta font-semibold text-ins-ink"
                >
                  <Icon name="checkCircle" className="size-4" />
                  {t.live} · {t.viewOnSite}
                  <Icon name="externalLink" className="size-3.5" />
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Workflow
              storyId={story.id}
              state={draft.saved.state}
              version={draft.saved.version}
              updatedBy={draft.saved.updatedBy}
              staff={staff}
              dirty={dirty}
              errorCount={report.errors.length}
              todoCount={report.todos.length}
              live={live}
              wasPublished={wasPublished}
              twoPersonRule={twoPersonRule}
              onDone={afterStep}
            />
            <SaveStatus
              dirty={dirty}
              saving={saving}
              savedAt={draft.saved.savedAt}
            />
            <Button
              variant="primary"
              busy={saving}
              disabled={!dirty}
              onClick={() => void save()}
              title="Ctrl+S"
            >
              {t.save}
            </Button>
            <Button onClick={() => downloadJson(`${story.id}.json`, content)}>
              {t.export}
            </Button>
            {hasRole(staff, 'admin') && !live && (
              <Button variant="danger" busy={remove.busy} onClick={deleteStory}>
                {t.delete}
              </Button>
            )}
          </div>
        </header>

        {notice}
        {done && !dirty && (
          <Notice tone="success">{adminCopy.workflow.done[done]}</Notice>
        )}
        {draft.saveError && (
          <Notice tone="error">
            <p>{draft.saveError.message}</p>
            {draft.saveError.conflict && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  onClick={() => downloadJson(`${story.id}.json`, content)}
                >
                  {t.conflict.export}
                </Button>
                <Button onClick={() => revalidate()}>
                  {t.conflict.reload}
                </Button>
              </div>
            )}
          </Notice>
        )}
        {remove.error && <Notice tone="error">{remove.error}</Notice>}
        {draft.saved.state === 'changes_requested' &&
          draft.saved.reviewNote && (
            <Notice tone="warning">
              <span className="font-semibold">{t.reviewNote}:</span>{' '}
              {draft.saved.reviewNote}
            </Notice>
          )}

        <Tabs tab={tab} onChange={setTab} />

        {tab === 'edit' ? (
          <div
            role="tabpanel"
            id="panel-edit"
            aria-labelledby="tab-edit"
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
          >
            <ErrorsProvider errors={errors}>
              <div className="flex min-w-0 flex-col gap-5">
                {SECTIONS.map(({ id }) => {
                  const Section = SECTION_COMPONENTS[id]
                  return <Section key={id} />
                })}
              </div>
            </ErrorsProvider>
            <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
              <ChecksPanel report={report} onGo={goTo} />
              <nav
                aria-label={t.sections.jump}
                className="rounded-card border border-line bg-surface p-2"
              >
                <ul>
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#sec-${s.id}`}
                        className="flex min-h-11 items-center rounded-lg px-3 text-small font-semibold hover:bg-paper"
                      >
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        ) : (
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            {tab === 'preview' && (
              <StoryPreview content={asPublished(content, today())} />
            )}
            {tab === 'diff' && (
              <DiffView live={liveContent} working={content} dirty={dirty} />
            )}
            {tab === 'history' && (
              <HistoryView
                storyId={story.id}
                names={names}
                version={draft.saved.version}
                dirty={dirty}
                onRestored={() => afterStep('restore')}
              />
            )}
          </div>
        )}
      </div>
    </EditorContext.Provider>
  )
}

export function Component() {
  const data = useLoaderData() as Data
  // a fresh load of the story (after publishing, or reloading after a conflict) starts over
  return <EditorBody key={`${data.story.id}:${data.story.version}`} {...data} />
}
