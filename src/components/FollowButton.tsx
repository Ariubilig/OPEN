import { useId, useState, type FormEvent } from 'react'
import { copy } from '../copy'
import { ApiError, subscribe } from '../data/api'
import Icon from './Icon'
import Modal, { modalInput, modalPrimary, modalSecondary } from './Modal'

const t = copy.alerts

/**
 * "Шат өөрчлөгдөхөд мэдэгдэл авах": follow this story by email. The first time, the reader gets
 * a link to confirm the address; the page says the same either way.
 */
export default function FollowButton({ storyId }: { storyId: string }) {
  const emailId = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  function start() {
    setState('idle')
    setError(null)
    setOpen(true)
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await subscribe(storyId, email.trim())
      setState('sent')
    } catch (err) {
      setState('idle')
      const code = err instanceof ApiError ? err.code : undefined
      setError(
        code === 'PT400' ? t.invalid : code === 'PT429' ? t.tooMany : t.failed,
      )
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-full border border-line-strong bg-surface px-[22px] font-semibold text-ink transition-colors hover:border-ink"
      >
        <Icon name="calendar" className="size-5" />
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
              <label htmlFor={emailId} className="text-small font-semibold">
                {t.email}
              </label>
              <input
                id={emailId}
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${modalInput} min-h-11 py-2`}
              />
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
