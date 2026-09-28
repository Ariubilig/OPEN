// A modal on the native <dialog>: focus stays inside, Esc closes, the page behind is inert.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import Icon from '../components/Icon'
import { adminCopy } from './copy'

export default function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(560px,calc(100vw-2rem))] rounded-card-lg border border-line bg-surface p-0 text-ink backdrop:bg-ink/45"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-[20px] leading-7">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={adminCopy.common.close}
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
