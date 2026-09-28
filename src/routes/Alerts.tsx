// The pages the alert emails link to. Both act only after a click: mail scanners open links on
// their own, and must not confirm an address or unsubscribe anyone by doing so.
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import Icon from '../components/Icon'
import { copy } from '../copy'
import { confirmSubscription, unsubscribe } from '../data/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const t = copy.alerts

function Page({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="mx-auto flex max-w-reading flex-col items-start gap-5 px-4 pt-10 md:pt-[72px]">
      <h1 className="text-h1 md:text-h1-lg">{title}</h1>
      {children}
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent underline underline-offset-3 hover:no-underline"
      >
        <Icon name="arrowLeft" className="size-4" />
        {t.back}
      </Link>
    </div>
  )
}

const BUTTON =
  'inline-flex min-h-[54px] items-center rounded-full bg-ink px-6 font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50'

/** A UUID-looking token, or null (anything else cannot be valid). */
function tokenFrom(params: URLSearchParams): string | null {
  const token = params.get('token') ?? ''
  return /^[0-9a-f-]{36}$/i.test(token) ? token : null
}

// Each link is its own page: a new token or story starts over.
export function ConfirmAlerts() {
  const [params] = useSearchParams()
  return <ConfirmPage key={params.toString()} params={params} />
}

export function Unsubscribe() {
  const [params] = useSearchParams()
  return <UnsubscribePage key={params.toString()} params={params} />
}

function ConfirmPage({ params }: { params: URLSearchParams }) {
  const token = tokenFrom(params)
  const [state, setState] = useState<
    'idle' | 'busy' | 'done' | 'invalid' | 'failed'
  >(token ? 'idle' : 'invalid')
  const [stories, setStories] = useState<{ id: string; title: string }[]>([])

  async function confirm() {
    if (!token) return
    setState('busy')
    try {
      const followed = await confirmSubscription(token)
      if (followed === null) return setState('invalid')
      setStories(followed)
      setState('done')
    } catch {
      setState('failed')
    }
  }

  return (
    <Page title={t.confirm.title}>
      {state === 'done' ? (
        <>
          <p role="status" className="flex items-start gap-2.5">
            <Icon name="checkCircle" className="mt-1 size-5 text-accent" />
            {t.confirm.done}
          </p>
          <ul className="flex flex-col gap-2">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/story/${s.id}`}
                  className="font-semibold text-accent underline underline-offset-3"
                >
                  {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : state === 'invalid' ? (
        <p role="alert">{t.confirm.invalid}</p>
      ) : (
        <>
          <p className="text-ink-2">{t.confirm.intro}</p>
          {state === 'failed' && (
            <p role="alert" className="font-semibold text-del-ink">
              {copy.error.text}
            </p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={state === 'busy'}
            className={BUTTON}
          >
            {t.confirm.button}
          </button>
        </>
      )}
    </Page>
  )
}

function UnsubscribePage({ params }: { params: URLSearchParams }) {
  const token = tokenFrom(params)
  const storyId = params.get('story')
  const [state, setState] = useState<
    'idle' | 'busy' | 'done' | 'invalid' | 'failed'
  >(token ? 'idle' : 'invalid')

  async function leave() {
    if (!token) return
    setState('busy')
    try {
      setState((await unsubscribe(token, storyId)) ? 'done' : 'invalid')
    } catch {
      setState('failed')
    }
  }

  return (
    <Page title={t.unsubscribe.title}>
      {state === 'done' ? (
        <p role="status" className="flex items-start gap-2.5">
          <Icon name="checkCircle" className="mt-1 size-5 text-accent" />
          {t.unsubscribe.done}
        </p>
      ) : state === 'invalid' ? (
        <p role="alert">{t.unsubscribe.invalid}</p>
      ) : (
        <>
          <p className="text-ink-2">
            {storyId ? t.unsubscribe.introStory : t.unsubscribe.introAll}
          </p>
          {state === 'failed' && (
            <p role="alert" className="font-semibold text-del-ink">
              {copy.error.text}
            </p>
          )}
          <button
            type="button"
            onClick={leave}
            disabled={state === 'busy'}
            className={BUTTON}
          >
            {t.unsubscribe.button}
          </button>
        </>
      )}
    </Page>
  )
}
