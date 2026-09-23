import { useEffect } from 'react'
import { APP_NAME } from '../config'
import { copy } from '../copy'

/** Sets `<title>`: "Page — APP_NAME", or "APP_NAME — tagline" when no page title is given. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} — ${APP_NAME}`
      : `${APP_NAME} — ${copy.tagline}`
  }, [title])
}
