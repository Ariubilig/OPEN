// "Сайтынхтай харьцуулах": what changes for readers when this working copy is published.
import { useMemo } from 'react'
import { adminCopy } from '../copy'
import { Notice } from '../ui'
import { lineDiff, prettyJson, publicView, type Block } from './compare'

const t = adminCopy.diff
const CONTEXT = 3

const LINE = {
  added: 'bg-ins-bg text-ins-ink',
  removed: 'bg-del-bg text-del-ink line-through decoration-del-ink/40',
  same: 'text-ink-2',
} as const
const MARK = { added: '+', removed: '−', same: ' ' } as const

function BlockLines({
  block,
  first,
  last,
}: {
  block: Block
  first: boolean
  last: boolean
}) {
  const { kind, lines } = block
  // long unchanged stretches: a few lines of context around the changes
  if (kind === 'same' && lines.length > CONTEXT * 2 + 1) {
    const head = first ? [] : lines.slice(0, CONTEXT)
    const tail = last ? [] : lines.slice(-CONTEXT)
    const hidden = lines.length - head.length - tail.length
    return (
      <>
        {head.map((line, i) => (
          <Line key={`h${i}`} kind={kind} line={line} />
        ))}
        <div className="px-3 py-1 font-sans text-meta text-muted">
          {t.unchanged(hidden)}
        </div>
        {tail.map((line, i) => (
          <Line key={`t${i}`} kind={kind} line={line} />
        ))}
      </>
    )
  }
  return (
    <>
      {lines.map((line, i) => (
        <Line key={i} kind={kind} line={line} />
      ))}
    </>
  )
}

function Line({ kind, line }: { kind: Block['kind']; line: string }) {
  return (
    <div className={`flex gap-2 px-3 ${LINE[kind]}`}>
      <span aria-hidden="true" className="w-3 shrink-0 select-none">
        {MARK[kind]}
      </span>
      {kind !== 'same' && (
        <span className="sr-only">
          {kind === 'added' ? t.added : t.removed}:{' '}
        </span>
      )}
      <span className="min-w-0 break-words whitespace-pre-wrap">{line}</span>
    </div>
  )
}

/** A line diff with its legend: long unchanged stretches folded to a few lines of context. */
export function LineDiff({ blocks }: { blocks: Block[] }) {
  return (
    <>
      <div className="flex gap-4 text-meta font-semibold">
        <span className="rounded bg-ins-bg px-2 text-ins-ink">+ {t.added}</span>
        <span className="rounded bg-del-bg px-2 text-del-ink">
          − {t.removed}
        </span>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-surface py-2 font-mono text-[13px] leading-5">
        {blocks.map((block, i) => (
          <BlockLines
            key={i}
            block={block}
            first={i === 0}
            last={i === blocks.length - 1}
          />
        ))}
      </div>
    </>
  )
}

export default function DiffView({
  live,
  working,
  dirty,
}: {
  /** the published content, or null when the story is not live */
  live: unknown
  working: unknown
  dirty: boolean
}) {
  const blocks = useMemo(
    () =>
      live ? lineDiff(prettyJson(live), prettyJson(publicView(working))) : [],
    [live, working],
  )
  if (!live) return <Notice>{t.notLive}</Notice>
  if (blocks.every((b) => b.kind === 'same'))
    return <Notice tone="success">{t.same}</Notice>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">
        {t.intro} {dirty && t.unsaved}
      </p>
      <LineDiff blocks={blocks} />
    </div>
  )
}
