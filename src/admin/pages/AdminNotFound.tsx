import { Link } from 'react-router'
import { copy } from '../../copy'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'

export function Component() {
  useDocumentTitle(copy.notFound.title)
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-h2">{copy.notFound.title}</h1>
      <Link
        to="/admin"
        className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-3"
      >
        {adminCopy.nav.stories}
      </Link>
    </div>
  )
}
