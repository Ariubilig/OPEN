import { copy } from '../copy'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function Feed() {
  useDocumentTitle()
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8">
      <h1 className="text-h1 md:text-h1-lg">{copy.tagline}</h1>
      <p className="mt-3 max-w-reading text-muted">{copy.feed.intro}</p>
    </div>
  )
}
