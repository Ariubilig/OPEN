import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { copy } from '../copy'
import { ApiError, submitReport } from '../data/api'
import Icon from './Icon'

const t = copy.report

/**
 * "Алдаа мэдээлэх": a reader tells the newsroom about an error in this story. Goes to the
 * admin's report inbox; the database limits how often one address can send.
 */
export default function ReportButton({ storyId }: { storyId: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()
  const contactId = useId()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  function start() {
    setMessage('')
    setContact('')
    setState('idle')
    setError(null)
    setOpen(true)
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (message.trim().length < 5) return setError(t.tooShort)
    setState('sending')
    setError(null)
    try {
      await submitReport(storyId, message.trim(), contact.trim())
      setState('sent')
    } catch (err) {
      setState('idle')
      setError(
        err instanceof ApiError && err.code === 'PT429' ? t.tooMany : t.failed,
      )
    }
  }

  const input =
    'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] leading-6 text-ink'

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-accent underline underline-offset-3 hover:no-underline"
      >
        <Icon name="flag" className="size-4" />
        {t.button}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-card-lg border border-line bg-surface p-0 text-ink backdrop:bg-ink/45"
      >
        {open && (
          <div className="flex flex-col gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-h2">
                {t.title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-paper"
              >
                <Icon name="close" className="size-5" />
              </button>
            </div>
            {state === 'sent' ? (
              <>
                <p role="status" className="flex items-start gap-2.5">
                  <Icon
                    name="checkCircle"
                    className="mt-1 size-5 text-accent"
                  />
                  {t.sent}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 items-center self-end rounded-full bg-ink px-5 font-semibold text-white"
                >
                  {t.close}
                </button>
              </>
            ) : (
              <form onSubmit={send} className="flex flex-col gap-4">
                <p className="text-ink-2">{t.intro}</p>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={messageId}
                    className="text-small font-semibold"
                  >
                    {t.message}
                  </label>
                  <textarea
                    id={messageId}
                    required
                    rows={4}
                    maxLength={2000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-describedby={`${messageId}-hint`}
                    className={`${input} py-2.5`}
                  />
                  <p id={`${messageId}-hint`} className="text-meta text-muted">
                    {t.messageHint}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor={contactId}
                    className="text-small font-semibold"
                  >
                    {t.contact}
                  </label>
                  <input
                    id={contactId}
                    maxLength={200}
                    autoComplete="email"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    aria-describedby={`${contactId}-hint`}
                    className={`${input} min-h-11 py-2`}
                  />
                  <p id={`${contactId}-hint`} className="text-meta text-muted">
                    {t.contactHint}
                  </p>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="text-small font-semibold text-del-ink"
                  >
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-11 items-center rounded-full px-5 font-semibold text-ink hover:bg-paper"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={state === 'sending'}
                    className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
                  >
                    {t.send}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
