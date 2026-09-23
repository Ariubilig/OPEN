import { useId, useState } from 'react'
import { copy } from '../copy'
import { TODO, type Change } from '../data/schema'
import { lawDiff } from '../lib/diff'
import { formatDate } from '../lib/format'
import CitedText, { MarkedText } from './CitedText'
import DataText from './DataText'
import Icon from './Icon'

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
            <span key={i}>{part.text}</span>
          ) : part.kind === 'removed' ? (
            <del
              key={i}
              className="rounded-sm bg-del-bg text-del-ink decoration-del-ink/70"
            >
              <span className="sr-only">[{copy.story.removed}: </span>
              {part.text}
              <span className="sr-only">]</span>
            </del>
          ) : (
            <ins
              key={i}
              className="rounded-sm bg-ins-bg text-ins-ink no-underline"
            >
              <span className="sr-only">[{copy.story.added}: </span>
              {part.text}
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

export default function ChangeBlock({ change }: { change: Change }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const lawPending =
    change.lawBefore.includes(TODO) || change.lawAfter.includes(TODO)

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-small font-semibold text-muted">
        <DataText value={change.clause} />
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-paper p-3">
          <p className="text-small font-semibold text-muted">
            {copy.story.before}
          </p>
          <p className="mt-1">
            <CitedText cited={change.plainBefore} />
          </p>
        </div>
        <div className="rounded-lg bg-accent-soft p-3">
          <p className="text-small font-semibold text-accent">
            {copy.story.after}
          </p>
          <p className="mt-1">
            <CitedText cited={change.plainAfter} />
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3">
        {change.effectiveFrom && (
          <p className="rounded-full bg-paper px-2.5 py-0.5 text-small font-semibold text-ink tabular-nums ring-1 ring-line ring-inset">
            {copy.story.effectiveFrom}: {formatDate(change.effectiveFrom)}
          </p>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-small font-semibold text-accent hover:bg-accent-soft"
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
        className="mt-2 rounded-lg border border-line p-3 text-[16px] leading-[26px]"
      >
        <p className="mb-2 text-small font-semibold text-muted">
          <MarkedText
            text={copy.story.lawText}
            source={change.lawSource}
            sentence={change.clause}
          />
        </p>
        {lawPending ? (
          <LawPending before={change.lawBefore} after={change.lawAfter} />
        ) : (
          <LawDiff before={change.lawBefore} after={change.lawAfter} />
        )}
      </div>
    </div>
  )
}
