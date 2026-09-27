// Every staff page: guard (staffLoader), top bar with navigation and the signed-in person.
import { useEffect } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigate,
  useRouteError,
} from 'react-router'
import { PendingBar } from '../components/Layout'
import Wordmark from '../components/Wordmark'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { adminCopy } from './copy'
import { staffLoader, type StaffSession } from './session'
import { supabase } from './supabase'
import { Button, Notice } from './ui'

export const loader = staffLoader

function navClass({ isActive }: { isActive: boolean }) {
  return `inline-flex min-h-11 items-center rounded-full px-3.5 text-small font-semibold transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink hover:bg-paper'
  }`
}

async function signOut() {
  await supabase.auth.signOut()
}

function NoAccess({ email }: { email: string }) {
  useDocumentTitle(adminCopy.noAccess.title)
  return (
    <main className="mx-auto flex min-h-dvh max-w-reading flex-col justify-center gap-5 px-4">
      <Wordmark />
      <h1 className="text-h1">{adminCopy.noAccess.title}</h1>
      <p className="text-ink-2">{adminCopy.noAccess.text(email)}</p>
      <div>
        <Button onClick={signOut}>{adminCopy.signOut}</Button>
      </div>
    </main>
  )
}

export function Component() {
  const { email, staff } = useLoaderData() as StaffSession
  const navigate = useNavigate()

  // Signed out here or in another tab, or the session expired: back to the sign-in page.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') navigate('/admin/login', { replace: true })
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  if (!staff) return <NoAccess email={email} />

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-surface focus:px-4 focus:py-3 focus:text-accent"
      >
        {adminCopy.nav.label}
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 md:px-6">
          <Link
            to="/admin"
            className="flex min-h-11 shrink-0 items-center gap-2.5"
          >
            <Wordmark size="sm" />
            <span className="text-small font-semibold text-muted">
              {adminCopy.title}
            </span>
          </Link>
          <nav
            aria-label={adminCopy.nav.label}
            className="order-last -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto"
          >
            <NavLink to="/admin" end className={navClass}>
              {adminCopy.nav.stories}
            </NavLink>
            <NavLink to="/admin/reports" className={navClass}>
              {adminCopy.nav.reports}
            </NavLink>
            <NavLink to="/admin/settings" className={navClass}>
              {adminCopy.nav.settings}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <Link
              to="/"
              className="hidden min-h-11 items-center text-small font-semibold text-accent underline underline-offset-3 hover:no-underline sm:inline-flex"
            >
              {adminCopy.nav.site}
            </Link>
            <span className="text-right text-meta leading-tight">
              <span className="block font-bold">{staff.name}</span>
              <span className="text-muted">{adminCopy.roles[staff.role]}</span>
            </span>
            <Button onClick={signOut}>{adminCopy.signOut}</Button>
          </div>
        </div>
      </header>
      <main
        id="admin-main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 focus:outline-none md:px-6 md:py-8"
      >
        <PendingBar />
        <Outlet />
      </main>
    </div>
  )
}

/** A staff page failed to load: the message, and the way back to the list. */
export function ErrorBoundary() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  const message = (error as { message?: unknown } | null)?.message
  const text =
    typeof message !== 'string'
      ? adminCopy.errors.unknown
      : (adminCopy.errors.codes[message] ??
        (/fetch|network/i.test(message)
          ? adminCopy.errors.network
          : `${adminCopy.errors.unknown} (${message})`))
  return (
    <main className="mx-auto max-w-reading px-4 py-12">
      <Notice tone="error">{text}</Notice>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => window.location.reload()}>
          {adminCopy.common.retry}
        </Button>
        <Link
          to="/admin"
          className="inline-flex min-h-11 items-center px-3 font-semibold text-accent"
        >
          {adminCopy.nav.stories}
        </Link>
      </div>
    </main>
  )
}
