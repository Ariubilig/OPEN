import { useId, useState } from 'react'
import { copy } from '../copy'
import { TODO, type Change } from '../data/schema'
import { lawDiff } from '../lib/diff'
import { formatDate } from '../lib/format'
import { keepNumbersTogether } from '../lib/typography'
import CitedText, { MarkedText } from './CitedText'
import DataText from './DataText'
import Icon from './Icon'

type LawView = 'diff' | 'before' | 'after'
const LAW_VIEWS: LawView[] = ['diff', 'before', 'after']

function LawDiff({ before, after }: { before: string; after: string }) {
  return (
    <>
      <p
        className="flex flex-wrap gap-3 text-small text-muted"
        aria-hidden="true"
      >
        <span className="rounded bg-del-bg px-1.5 text-del-ink line-through">
          {copy.story.removed}
        </span>
        <span className="rounded bg-ins-bg px-1.5 text-ins-ink">
          {copy.story.added}
        </span>
      </p>
      <p className="mt-2 whitespace-pre-line">
        {lawDiff(before, after).map((part, i) =>
          part.kind === 'same' ? (
            <span key={i}>{keepNumbersTogether(part.text)}</span>
          ) : part.kind === 'removed' ? (
            <del
              key={i}
              className="rounded-sm bg-del-bg text-del-ink decoration-del-ink/70"
            >
              <span className="sr-only">[{copy.story.removed}: </span>
              {keepNumbersTogether(part.text)}
              <span className="sr-only">]</span>
            </del>
          ) : (
            <ins
              key={i}
              className="rounded-sm bg-ins-bg text-ins-ink no-underline"
            >
              <span className="sr-only">[{copy.story.added}: </span>
              {keepNumbersTogether(part.text)}
              <span className="sr-only">]</span>
            </ins>
          ),
        )}
      </p>
    </>
  )
}

/** Law text is still being copied from legalinfo.mn: show both sides as placeholders. */
function LawPending({ before, after }: { before: string; after: string }) {
  return (
    <dl className="space-y-2">
      <div>
        <dt className="text-small font-semibold text-muted">
          {copy.story.before}
        </dt>
        <dd>
          <DataText value={before} />
        </dd>
      </div>
      <div>
        <dt className="text-small font-semibold text-muted">
          {copy.story.after}
        </dt>
        <dd>
          <DataText value={after} />
        </dd>
      </div>
    </dl>
  )
}

/**
 * Both law texts exist: the word diff by default, or either text on its own to read it clean
 * (long clauses with many changed numbers are hard to read as a diff).
 */
function LawCompare({ before, after }: { before: string; after: string }) {
  const [view, setView] = useState<LawView>('diff')
  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={copy.story.lawView.label}
        className="inline-flex self-start rounded-full bg-paper p-1"
      >
        {LAW_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-small font-semibold transition-colors ${
              view === v ? 'bg-ink text-white' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {copy.story.lawView[v]}
          </button>
        ))}
      </div>
      {view === 'diff' ? (
        <div>
          <LawDiff before={before} after={after} />
        </div>
      ) : (
        <p className="whitespace-pre-line">
          {keepNumbersTogether(view === 'before' ? before : after)}
        </p>
      )}
    </div>
  )
}

/** A clause that did not exist before: its new text, clean. */
function LawNew({ after }: { after: string }) {
  return (
    <>
      <p className="inline-flex rounded-md bg-ins-bg px-2 py-0.5 text-small font-semibold text-ins-ink">
        {copy.story.newClause}
      </p>
      <p className="mt-2 whitespace-pre-line">{keepNumbersTogether(after)}</p>
    </>
  )
}

function BeforeAfterTag({ after }: { after: boolean }) {
  return (
    <span
      className={`inline-flex h-6 items-center self-start rounded-md px-2 text-meta font-bold ${
        after
          ? 'bg-highlight text-ink'
          : 'bg-paper text-muted shadow-[inset_0_0_0_1px_var(--line-strong)]'
      }`}
    >
      {after ? copy.story.after : copy.story.before}
    </span>
  )
}

/** One changed clause: Өмнө → Шинэ in plain words, then the exact law text on demand. */
export default function ChangeBlock({ change }: { change: Change }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const lawPending =
    change.lawBefore.includes(TODO) || change.lawAfter.includes(TODO)

  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface px-4 pt-4 pb-2.5 md:px-6 md:pt-[22px] md:pb-3.5">
      <p className="text-meta leading-[19px] font-semibold text-muted">
        <DataText value={change.clause} />
      </p>

      <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] md:items-start md:gap-x-[18px]">
        <div className="flex flex-col gap-2">
          <BeforeAfterTag after={false} />
          <p className="text-[16px] leading-[25px] text-ink-2">
            <CitedText cited={change.plainBefore} />
          </p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-paper md:mt-[26px] md:size-9"
        >
          <Icon name="arrowDown" className="size-[18px] md:hidden" />
          <Icon name="arrowRight" className="hidden size-[18px] md:block" />
        </span>
        <div className="flex flex-col gap-2">
          <BeforeAfterTag after />
          <p className="text-[16px] leading-[25px] font-medium">
            <CitedText cited={change.plainAfter} />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-line pt-1.5">
        {change.effectiveFrom && (
          <p className="inline-flex items-center gap-[7px] text-meta font-semibold tabular-nums">
            <Icon name="calendar" className="size-4 text-muted" />
            {copy.story.effectiveFrom}: {formatDate(change.effectiveFrom)}
          </p>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="-mr-1.5 ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-1.5 text-small font-semibold text-accent hover:text-accent-strong"
        >
          {open ? copy.story.hideLaw : copy.story.showLaw}
          <Icon
            name="chevronDown"
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="mb-2 rounded-xl border border-line p-3 text-[16px] leading-[26px] md:p-4"
      >
        <p className="mb-3 text-small font-semibold text-muted">
          <MarkedText
            text={copy.story.lawText}
            source={change.lawSource}
            sentence={change.clause}
          />
        </p>
        {lawPending ? (
          <LawPending before={change.lawBefore} after={change.lawAfter} />
        ) : change.lawBefore === '' ? (
          <LawNew after={change.lawAfter} />
        ) : (
          <LawCompare before={change.lawBefore} after={change.lawAfter} />
        )}
      </div>
    </article>
  )
}
