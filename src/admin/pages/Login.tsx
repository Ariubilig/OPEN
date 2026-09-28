// Sign-in with a 6-digit code sent by email. Only existing accounts get a code (sign-up is off),
// and the page says the same thing either way, so it does not reveal who is on the team.
import { useState, type FormEvent } from 'react'
import {
  redirect,
  useNavigate,
  useSearchParams,
  type LoaderFunctionArgs,
} from 'react-router'
import Wordmark from '../../components/Wordmark'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import { errorMessage } from '../errors'
import { safeNext } from '../session'
import { supabase } from '../supabase'
import { Button, Field, Notice, TextInput } from '../ui'

const t = adminCopy.login

export async function loader({ request }: LoaderFunctionArgs) {
  // also finishes a sign-in or invitation link: the client reads the session from the URL on start
  const { data } = await supabase.auth.getSession()
  if (data.session)
    throw redirect(safeNext(new URL(request.url).searchParams.get('next')))
  return null
}

/** Codes an unknown address gets back: shown as "sent" like any other address. */
const NOT_ON_TEAM = new Set([
  'otp_disabled',
  'signup_disabled',
  'user_not_found',
])

export function Component() {
  useDocumentTitle(t.title)
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/admin/login?next=${encodeURIComponent(next)}`,
      },
    })
    setBusy(false)
    if (error && !NOT_ON_TEAM.has(error.code ?? '')) {
      setError(error.status === 429 ? t.rateLimited : await errorMessage(error))
      return
    }
    setCode('')
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError(error.status === 429 ? t.rateLimited : t.badCode)
      return
    }
    navigate(next, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-4 py-10">
      <Wordmark />
      <h1 className="mt-6 text-h1">{t.title}</h1>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="mt-6 flex flex-col gap-4">
          <p className="text-ink-2">{t.intro}</p>
          <Field label={t.email}>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" busy={busy}>
            {t.send}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 flex flex-col gap-4">
          <Notice tone="info">{t.sent(email.trim())}</Notice>
          <Field label={t.code}>
            {(props) => (
              <TextInput
                {...props}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-[22px] tracking-[0.3em] tabular-nums"
              />
            )}
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" busy={busy}>
            {t.verify}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setStep('email')
                setError(null)
              }}
            >
              {t.otherEmail}
            </Button>
            <Button variant="ghost" onClick={() => sendCode()} disabled={busy}>
              {t.resend}
            </Button>
          </div>
        </form>
      )}
    </main>
  )
}
