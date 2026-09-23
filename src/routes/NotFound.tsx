import { Link } from 'react-router'
import { copy } from '../copy'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle(copy.notFound.title)
  return (
    <div className="mx-auto max-w-reading px-4 pt-12">
      <h1 className="text-h1 md:text-h1-lg">{copy.notFound.title}</h1>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-11 items-center text-accent underline underline-offset-2"
      >
        {copy.notFound.back}
      </Link>
    </div>
  )
}
