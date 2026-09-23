import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { copy } from '../copy'
import { TODO, type Source, type Story } from '../data/schema'
import { SourceSheetContext, type SourceSheetApi } from '../lib/sourceSheet'
import { numberSources } from '../lib/sources'
import DataText from './DataText'
import Icon from './Icon'
import Placeholder from './Placeholder'
import { KindBadge, SourceDates, SourceNumber } from './SourceMeta'

/** 'https://www.ikon.mn/n/3ojp' → 'ikon.mn' */
function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

type Current = { sourceId: string; sentence: string }

/**
 * Provides source numbers to every marker of a story and owns the one SourceSheet:
 * a native <dialog> opened with showModal() — focus trap, Esc and inert background for free.
 * Bottom sheet on phones, right-side panel from 768px.
 */
export default function SourceSheetProvider({
  story,
  children,
}: {
  story: Story
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [current, setCurrent] = useState<Current | null>(null)

  const open = useCallback(
    (sourceId: string, sentence: string, trigger: HTMLElement) => {
      // Focus the marker before showModal(): the dialog then restores focus to it on every
      // close path (Esc, button, backdrop), including Safari, which does not focus tapped buttons.
      trigger.focus({ preventScroll: true })
      // the tapped marker shows as active (solid violet) while its sheet is open
      trigger.setAttribute('aria-expanded', 'true')
      triggerRef.current = trigger
      setCurrent({ sourceId, sentence })
    },
    [],
  )
  const api = useMemo<SourceSheetApi>(
    () => ({
      numbers: numberSources(story),
      sources: new Map(story.sources.map((s) => [s.id, s])),
      open,
    }),
    [story, open],
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (current && dialog && !dialog.open) dialog.showModal()
  }, [current])

  // Runs synchronously on every close path (the dialog's `close` event can arrive late),
  // and again from onClose as a no-op fallback.
  const finish = () => {
    const trigger = triggerRef.current
    triggerRef.current = null
    setCurrent(null)
    trigger?.removeAttribute('aria-expanded')
    trigger?.focus()
  }
  const close = () => {
    dialogRef.current?.close()
    finish()
  }

  const source = current ? api.sources.get(current.sourceId) : undefined
  const n = current ? api.numbers.get(current.sourceId) : undefined

  return (
    <SourceSheetContext value={api}>
      {children}
      <dialog
        ref={dialogRef}
        onClose={finish}
        // a click on the dialog box itself (not its content) is a click on the backdrop
        onClick={(e) => e.target === e.currentTarget && close()}
        aria-labelledby="source-sheet-title"
        className="source-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[26px] bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/55 md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-dvh md:w-[440px] md:rounded-none md:rounded-l-[26px]"
      >
        {current && source && n !== undefined && (
          <SheetContent
            n={n}
            total={story.sources.length}
            sentence={current.sentence}
            source={source}
            onClose={close}
          />
        )}
      </dialog>
    </SourceSheetContext>
  )
}

function SheetContent({
  n,
  total,
  sentence,
  source,
  onClose,
}: {
  n: number
  total: number
  sentence: string
  source: Source
  onClose: () => void
}) {
  const cut = sentence.lastIndexOf(' ') + 1
  const domain = source.url === TODO ? null : domainOf(source.url)
  return (
    <div className="flex flex-col gap-4 px-5 pt-2.5 pb-6 md:gap-5 md:px-7 md:pt-6 md:pb-7">
      <span
        aria-hidden="true"
        className="mx-auto h-[5px] w-10 rounded-full bg-line-strong md:hidden"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2.5">
          <SourceNumber n={n} active />
          <span className="eyebrow text-muted">
            {copy.source.position(n, total)}
          </span>
        </p>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-paper px-3.5 text-small font-semibold text-ink hover:bg-line"
        >
          {copy.source.close}
          <Icon name="close" />
        </button>
      </div>

      <figure className="flex flex-col gap-2">
        <figcaption className="eyebrow text-muted">
          {copy.source.citedSentence}
        </figcaption>
        <blockquote className="rounded-2xl bg-paper px-4 py-3.5 text-[16px] leading-[25px]">
          <DataText value={sentence.slice(0, cut)} />
          <span className="whitespace-nowrap">
            <DataText value={sentence.slice(cut)} />
            <span
              aria-hidden="true"
              className="ml-[5px] inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-md bg-accent px-[5px] align-middle text-[12px] leading-none font-bold text-white tabular-nums"
            >
              {n}
            </span>
          </span>
        </blockquote>
      </figure>

      <div className="flex flex-col gap-2.5 border-t border-line pt-[18px]">
        <div className="flex flex-col items-start gap-1.5">
          <KindBadge kind={source.kind} />
          <p className="text-meta text-muted">
            {copy.source.kindHint[source.kind]}
          </p>
        </div>
        <h2
          id="source-sheet-title"
          className="mt-1 text-[21px] leading-[27px] break-words md:text-[23px] md:leading-[29px]"
        >
          <DataText value={source.title} />
        </h2>
        <p className="text-[15px] leading-[21px] text-muted">
          <DataText value={source.publisher} />
        </p>
        <SourceDates source={source} variant="tiles" />
        {source.note && (
          <p className="text-small leading-[21px] text-ink-2">
            <DataText value={source.note} />
          </p>
        )}
      </div>

      {source.url === TODO ? (
        <Placeholder />
      ) : (
        <div className="flex flex-col gap-2">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            {copy.source.open}
            <Icon name="externalLink" className="size-[18px]" />
            <span className="sr-only">
              {' '}
              ({domain ? `${domain}, ` : ''}
              {copy.a11y.newTab})
            </span>
          </a>
          <p aria-hidden="true" className="text-center text-meta text-muted">
            {domain ? `${domain} · ` : ''}
            {copy.a11y.newTab}
          </p>
        </div>
      )}
    </div>
  )
}
