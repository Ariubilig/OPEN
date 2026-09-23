import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { copy } from '../copy'
import type { Story } from '../data/schema'
import { SourceSheetContext, type SourceSheetApi } from '../lib/sourceSheet'
import { numberSources } from '../lib/sources'
import DataText from './DataText'
import ExternalLink from './ExternalLink'
import Icon from './Icon'
import { KindBadge, SourceDates, SourceNumber } from './SourceMeta'

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
        className="source-sheet m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 md:mt-0 md:mr-0 md:ml-auto md:h-dvh md:max-h-dvh md:w-[420px] md:rounded-none md:rounded-l-2xl"
      >
        {current && source && n !== undefined && (
          <div className="px-5 pt-3 pb-8">
            <div className="flex items-center justify-between gap-4">
              <p className="text-small font-semibold text-muted">
                {copy.source.citedSentence}
              </p>
              <button
                type="button"
                onClick={close}
                className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-small font-semibold text-ink hover:bg-paper"
              >
                {copy.source.close}
                <Icon name="close" />
              </button>
            </div>
            <blockquote className="mt-1 border-l-2 border-accent pl-3">
              <DataText value={current.sentence} />
            </blockquote>

            <div className="mt-6 flex gap-3">
              <SourceNumber n={n} />
              <div className="min-w-0 space-y-2">
                <h2
                  id="source-sheet-title"
                  className="text-[19px] leading-[26px] break-words"
                >
                  <DataText value={source.title} />
                </h2>
                <p className="text-small text-muted">
                  <DataText value={source.publisher} />
                </p>
                <KindBadge kind={source.kind} />
                <SourceDates source={source} />
                {source.note && (
                  <p className="text-small">
                    <DataText value={source.note} />
                  </p>
                )}
                <ExternalLink href={source.url}>
                  {copy.source.open}
                </ExternalLink>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </SourceSheetContext>
  )
}
