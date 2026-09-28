// Readers' error reports: new ones first; staff check them against the sources and close them
// as resolved (the story was fixed) or dismissed (nothing to fix), with a note.
import { useState } from 'react'
import {
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from 'react-router'
import Icon from '../../components/Icon'
import { formatDateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { call, supabase } from '../supabase'
import { Button, Field, Notice, PageHeader, TextArea, useAction } from '../ui'

const t = adminCopy.reports
const STATUSES = ['new', 'resolved', 'dismissed'] as const
type Status = (typeof STATUSES)[number]

export async function loader() {
  const [reports, stories, team] = await Promise.all([
    call(
      supabase
        .from('reports')
        .select(
          'id, story_id, message, contact, status, resolution_note, created_at, resolved_at, resolved_by',
        )
        .order('created_at', { ascending: false })
        .limit(500),
    ),
    call(supabase.from('story_admin_list').select('id, title, is_live')),
    call(supabase.from('staff').select('user_id, name')),
  ])
  return {
    reports,
    stories: new Map(stories.map((s) => [s.id ?? '', s])),
    names: new Map(team.map((m) => [m.user_id, m.name])),
  }
}

type Data = Awaited<ReturnType<typeof loader>>
type Report = Data['reports'][number]

function ReportCard({ report, data }: { report: Report; data: Data }) {
  const { revalidate } = useRevalidator()
  const [note, setNote] = useState(report.resolution_note ?? '')
  const action = useAction()
  const story = data.stories.get(report.story_id)

  async function close(status: Status) {
    if (
      await action.run(() =>
        call(
          supabase.rpc('resolve_report', {
            p_id: report.id,
            p_status: status,
            p_note: note,
          }),
        ),
      )
    )
      revalidate()
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{story?.title ?? report.story_id}</p>
          <p className="text-meta text-muted tabular-nums">
            {formatDateTime(report.created_at)} · {report.story_id}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-small font-semibold">
          <Link
            to={`/admin/stories/${report.story_id}`}
            className="inline-flex min-h-11 items-center text-accent"
          >
            {t.openStory}
          </Link>
          {story?.is_live && (
            <a
              href={`/story/${report.story_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-accent"
            >
              {t.onSite}
              <Icon name="externalLink" className="size-3.5" />
            </a>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap">{report.message}</p>
      {report.contact && (
        <p className="text-small">
          <span className="font-semibold">{t.contact}:</span> {report.contact}
        </p>
      )}
      {report.status === 'new' ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <Field label={t.note} hint={t.noteHint} optional>
            {(props) => (
              <TextArea
                {...props}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              busy={action.busy}
              onClick={() => close('resolved')}
            >
              {t.resolve}
            </Button>
            <Button busy={action.busy} onClick={() => close('dismissed')}>
              {t.dismiss}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-small">
          <p className="text-ink-2">
            <span className="font-semibold">{t.statuses[report.status]}</span>
            {report.resolved_at &&
              ` · ${t.closedBy(
                (report.resolved_by && data.names.get(report.resolved_by)) ||
                  '—',
                formatDateTime(report.resolved_at),
              )}`}
            {report.resolution_note && (
              <span className="block whitespace-pre-wrap">
                {report.resolution_note}
              </span>
            )}
          </p>
          <Button busy={action.busy} onClick={() => close('new')}>
            {t.reopen}
          </Button>
        </div>
      )}
      {action.error && <Notice tone="error">{action.error}</Notice>}
    </li>
  )
}

export function Component() {
  useDocumentTitle(`${t.title} · ${adminCopy.title}`)
  const data = useLoaderData() as Data
  const [params, setParams] = useSearchParams()
  const status: Status =
    STATUSES.find((s) => s === params.get('status')) ?? 'new'
  const shown = data.reports.filter((r) => r.status === status)

  return (
    <div className="flex max-w-[960px] flex-col gap-5">
      <PageHeader title={t.title} />
      <p className="-mt-2 text-small text-ink-2">{t.intro}</p>
      <div role="group" aria-label={t.filters} className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => setParams(s === 'new' ? {} : { status: s })}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-small font-semibold ${
              status === s
                ? 'bg-ink text-white'
                : 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]'
            }`}
          >
            {t.statuses[s]}
            <span
              className={`tabular-nums ${status === s ? 'text-highlight' : 'text-muted'}`}
            >
              {data.reports.filter((r) => r.status === s).length}
            </span>
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {shown.map((report) => (
            <ReportCard key={report.id} report={report} data={data} />
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
