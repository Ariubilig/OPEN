import { isRouteErrorResponse, useRouteError } from 'react-router'
import { copy } from '../copy'
import { configured } from '../data/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Icon from './Icon'
import { AppShell } from './Layout'

/** The page could not load its data: say so and offer a retry. */
export function PageError() {
  useDocumentTitle(copy.error.title)
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  const status = isRouteErrorResponse(error) ? error.status : null
  return (
    <div className="mx-auto max-w-reading px-4 pt-10 md:pt-[72px]">
      <h1 className="text-h1 md:text-h1-lg">{copy.error.title}</h1>
      <p className="mt-4 text-ink-2">
        {configured ? copy.error.text : copy.error.notConfigured}
        {status !== null && (
          <span className="ml-1 text-muted tabular-nums">({status})</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex min-h-[54px] items-center gap-2.5 rounded-full bg-ink px-6 font-semibold text-white transition-colors hover:bg-accent-strong"
      >
        <Icon name="arrowRight" className="size-5" />
        {copy.error.retry}
      </button>
    </div>
  )
}

/** The site-wide data (channels, tax rules) failed: the same message inside the page frame. */
export function RootError() {
  return (
    <AppShell>
      <PageError />
    </AppShell>
  )
}

/** First load, before any page data is in: the page frame with a quiet placeholder. */
export function LoadingScreen() {
  return (
    <AppShell>
      <div
        className="mx-auto max-w-page px-4 pt-8 md:px-8 md:pt-[72px]"
        aria-busy="true"
      >
        <p role="status" className="sr-only">
          {copy.loading}
        </p>
        <div aria-hidden="true" className="flex flex-col gap-4">
          <div className="h-10 w-4/5 max-w-[720px] rounded-xl bg-line md:h-20" />
          <div className="h-10 w-3/5 max-w-[540px] rounded-xl bg-line md:h-20" />
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:gap-6">
            <div className="h-64 rounded-card-lg bg-line/60" />
            <div className="h-64 rounded-card-lg bg-line/60" />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
