import { useId, useState, type FormEvent } from 'react'
import { copy } from '../copy'
import { ApiError, submitReport } from '../data/api'
import Icon from './Icon'
import Modal, { modalInput, modalPrimary, modalSecondary } from './Modal'

const t = copy.report

/**
 * "Алдаа мэдээлэх": a reader tells the newsroom about an error in this story. Goes to the
 * admin's report inbox; the database limits how often one address can send.
 */
export default function ReportButton({ storyId }: { storyId: string }) {
  const messageId = useId()
  const contactId = useId()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

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
      <Modal
        open={open}
        title={t.title}
        closeLabel={t.close}
        onClose={() => setOpen(false)}
      >
        {state === 'sent' ? (
          <>
            <p role="status" className="flex items-start gap-2.5">
              <Icon name="checkCircle" className="mt-1 size-5 text-accent" />
              {t.sent}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`${modalPrimary} self-end`}
            >
              {t.close}
            </button>
          </>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <p className="text-ink-2">{t.intro}</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={messageId} className="text-small font-semibold">
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
                className={`${modalInput} py-2.5`}
              />
              <p id={`${messageId}-hint`} className="text-meta text-muted">
                {t.messageHint}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={contactId} className="text-small font-semibold">
                {t.contact}
              </label>
              <input
                id={contactId}
                maxLength={200}
                autoComplete="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                aria-describedby={`${contactId}-hint`}
                className={`${modalInput} min-h-11 py-2`}
              />
              <p id={`${contactId}-hint`} className="text-meta text-muted">
                {t.contactHint}
              </p>
            </div>
            {error && (
              <p role="alert" className="text-small font-semibold text-del-ink">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={modalSecondary}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={state === 'sending'}
                className={modalPrimary}
              >
                {t.send}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
