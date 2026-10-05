// The story list: every working copy with its state, whether it is live, who changed it last,
// and how many values still wait for verification.
import { useMemo, useState } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'
import DataText from '../../components/DataText'
import Icon from '../../components/Icon'
import { formatDateTime, today } from '../../lib/format'
import { isOverdue } from '../../lib/timeline'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { asList, asObject } from '../editor/context'
import { call, supabase, type StoryState } from '../supabase'
import { PageHeader, StateBadge, TextInput } from '../ui'

const t = adminCopy.dashboard
const STATES: StoryState[] = [
  'draft',
  'in_review',
  'changes_requested',
  'published',
]

export async function loader() {
  const [rows, reports, changes, timelines] = await Promise.all([
    call(
      supabase
        .from('story_admin_list')
        .select(
          'id, state, title, type, stage, review_note, updated_at, updated_by_name, is_live, published_at, todo_count',
        )
        .order('updated_at', { ascending: false }),
    ),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),
    supabase
      .from('watch_events')
      .select('id', { count: 'exact', head: true })
      .is('seen_at', null),
    // only the timelines, for "a step's date has passed" (half-filled copies included)
    call(supabase.from('stories').select('id, timeline:content->timeline')),
  ])
  return {
    rows,
    timelines,
    newReports: reports.count ?? 0,
    newChanges: changes.count ?? 0,
  }
}

type Row = Awaited<ReturnType<typeof loader>>['rows'][number]

function StoryRow({ row, overdue }: { row: Row; overdue: number }) {
  return (
    <li className="relative grid gap-x-6 gap-y-2 rounded-card border border-line bg-surface p-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent lg:grid-cols-[minmax(0,1fr)_150px_170px_190px_110px] lg:items-center">
      <div className="min-w-0">
        <Link
          to={`/admin/stories/${row.id}`}
          className="font-bold text-ink after:absolute after:inset-0 after:rounded-card hover:text-accent-strong focus-visible:outline-none"
        >
          <DataText value={row.title ?? row.id ?? ''} />
        </Link>
        <p className="mt-0.5 truncate text-meta text-muted">
          {row.id} · {row.type} · {row.stage}
        </p>
        {overdue > 0 && (
          <p className="mt-1.5 text-meta font-semibold text-placeholder-ink">
            {t.overdue(overdue)}
          </p>
        )}
        {row.state === 'changes_requested' && row.review_note && (
          <p className="mt-1.5 text-meta text-placeholder-ink">
            <span className="font-bold">{t.reviewNote}:</span> {row.review_note}
          </p>
        )}
      </div>
      <div>
        <span className="sr-only">{t.columns.state}: </span>
        {row.state && <StateBadge state={row.state} />}
      </div>
      <div className="text-meta">
        <span className="sr-only">{t.columns.live}: </span>
        {row.is_live ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-ins-ink">
            <Icon name="checkCircle" className="size-4" />
            {t.live}
            {row.published_at && (
              <span className="font-normal text-muted tabular-nums">
                {' '}
                {formatDateTime(row.published_at).slice(0, 10)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted">{t.notLive}</span>
        )}
      </div>
      <div className="text-meta">
        <span className="sr-only">{t.columns.changed}: </span>
        {row.updated_at && (
          <span className="tabular-nums">{formatDateTime(row.updated_at)}</span>
        )}
        {row.updated_by_name && (
          <span className="block text-muted">{row.updated_by_name}</span>
        )}
      </div>
      <div
        className={`text-meta tabular-nums ${row.todo_count ? 'font-semibold text-placeholder-ink' : 'text-muted'}`}
      >
        <span className="sr-only">{t.columns.todos}: </span>
        {t.todos(row.todo_count ?? 0)}
      </div>
    </li>
  )
}

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const { rows, timelines, newReports, newChanges } =
    useLoaderData() as Awaited<ReturnType<typeof loader>>
  const [params, setParams] = useSearchParams()
  const state = STATES.find((s) => s === params.get('state')) ?? null
  const overdueOnly = params.get('overdue') === '1'
  const [query, setQuery] = useState('')
  const setFilter = (key: 'state' | 'overdue', value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  // upcoming steps whose date has passed, per story
  const overdueById = useMemo(() => {
    const now = today()
    return new Map(
      timelines.map((s) => [
        s.id,
        asList(s.timeline).filter((step) => isOverdue(asObject(step), now))
          .length,
      ]),
    )
  }, [timelines])
  const overdueOf = (id: string | null) => overdueById.get(id ?? '') ?? 0
  const overdueStories = rows.filter((r) => overdueOf(r.id) > 0).length

  const counts = useMemo(
    () =>
      Object.fromEntries(
        STATES.map((s) => [s, rows.filter((r) => r.state === s).length]),
      ) as Record<StoryState, number>,
    [rows],
  )
  const q = query.trim().toLowerCase()
  const shown = rows.filter(
    (r) =>
      (!state || r.state === state) &&
      (!overdueOnly || overdueOf(r.id) > 0) &&
      (!q ||
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.id ?? '').includes(q)),
  )

  const tab = (value: StoryState | null, label: string, count: number) => (
    <button
      key={value ?? 'all'}
      type="button"
      aria-pressed={state === value}
      onClick={() => setFilter('state', value)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-semibold whitespace-nowrap transition-colors ${
        state === value
          ? 'bg-ink text-white'
          : 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
      }`}
    >
      {label}
      <span
        className={`tabular-nums ${state === value ? 'text-highlight' : 'text-muted'}`}
      >
        {count}
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title}>
        <Link
          to="/admin/stories/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          <Icon name="document" className="size-[18px]" />
          {t.newStory}
        </Link>
      </PageHeader>

      {newReports > 0 && (
        <Link
          to="/admin/reports"
          className="flex min-h-11 items-center gap-2 self-start rounded-xl border border-placeholder-line bg-placeholder-bg px-4 py-2 text-small font-semibold text-placeholder-ink"
        >
          <Icon name="flag" className="size-4" />
          {adminCopy.reports.newCount(newReports)}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      )}
      {overdueStories > 0 && !overdueOnly && (
        <Link
          to="/admin?overdue=1"
          className="flex min-h-11 items-center gap-2 self-start rounded-xl border border-placeholder-line bg-placeholder-bg px-4 py-2 text-small font-semibold text-placeholder-ink"
        >
          <Icon name="calendar" className="size-4" />
          {t.overdueCount(overdueStories)}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      )}
      {newChanges > 0 && (
        <Link
          to="/admin/watch"
          className="flex min-h-11 items-center gap-2 self-start rounded-xl border border-placeholder-line bg-placeholder-bg px-4 py-2 text-small font-semibold text-placeholder-ink"
        >
          <Icon name="document" className="size-4" />
          {adminCopy.watch.newCount(newChanges)}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label={t.filters}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
        >
          {tab(null, t.all, rows.length)}
          {STATES.map((s) => tab(s, adminCopy.states[s], counts[s]))}
          {overdueStories > 0 && (
            <button
              type="button"
              aria-pressed={overdueOnly}
              onClick={() => setFilter('overdue', overdueOnly ? null : '1')}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-semibold whitespace-nowrap transition-colors ${
                overdueOnly
                  ? 'bg-ink text-white'
                  : 'bg-placeholder-bg text-placeholder-ink shadow-[inset_0_0_0_1px_var(--placeholder-line)] hover:shadow-[inset_0_0_0_1px_var(--ink)]'
              }`}
            >
              {t.overdueFilter}
              <span
                className={`tabular-nums ${overdueOnly ? 'text-highlight' : ''}`}
              >
                {overdueStories}
              </span>
            </button>
          )}
        </div>
        <TextInput
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="lg:max-w-[320px]"
        />
      </div>

      <div
        aria-hidden="true"
        className="hidden gap-x-6 px-4 text-meta font-semibold text-muted lg:grid lg:grid-cols-[minmax(0,1fr)_150px_170px_190px_110px]"
      >
        <span>{t.columns.story}</span>
        <span>{t.columns.state}</span>
        <span>{t.columns.live}</span>
        <span>{t.columns.changed}</span>
        <span>{t.columns.todos}</span>
      </div>
      {shown.length > 0 ? (
        <ul className="-mt-2 flex flex-col gap-2">
          {shown.map((row) => (
            <StoryRow key={row.id} row={row} overdue={overdueOf(row.id)} />
          ))}
        </ul>
      ) : (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-ink-2">
          {t.empty}
        </p>
      )}
    </div>
  )
}
