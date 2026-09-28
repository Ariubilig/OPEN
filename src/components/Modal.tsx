import { useEffect, useId, useRef, type ReactNode } from 'react'
import Icon from './Icon'

/**
 * A modal on the native <dialog>: focus stays inside, Esc and a click outside close it, the page
 * behind is inert. Content is only rendered while open.
 */
export default function Modal({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-card-lg border border-line bg-surface p-0 text-ink backdrop:bg-ink/45"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-h2">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-paper"
            >
              <Icon name="close" className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

/** Shared look of the small forms inside a Modal. */
export const modalInput =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] leading-6 text-ink'
export const modalPrimary =
  'inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50'
export const modalSecondary =
  'inline-flex min-h-11 items-center rounded-full px-5 font-semibold text-ink hover:bg-paper'
