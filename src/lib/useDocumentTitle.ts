import { useEffect } from 'react'
import { APP_NAME } from '../config'
import { copy } from '../copy'

/**
 * Sets `<title>`: "Page — APP_NAME", or "APP_NAME — tagline" when no page title is given.
 * `null` leaves the title alone (a page shown inside another, like the admin's preview).
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (title === null) return
    document.title = title
      ? `${title} — ${APP_NAME}`
      : `${APP_NAME} — ${copy.tagline}`
  }, [title])
}
