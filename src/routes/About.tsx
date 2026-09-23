import { copy } from '../copy'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function About() {
  useDocumentTitle(copy.about.title)
  return (
    <div className="mx-auto max-w-reading px-4 pt-8">
      <h1 className="text-h1 md:text-h1-lg">{copy.about.title}</h1>
    </div>
  )
}
