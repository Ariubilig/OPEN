import { useParams } from 'react-router'
import { getStory } from '../data'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import NotFound from './NotFound'

export default function Story() {
  const { id = '' } = useParams()
  const story = getStory(id)
  if (!story) return <NotFound />
  return <StoryPage title={story.title} />
}

// Story sections are built in Phase 3.
function StoryPage({ title }: { title: string }) {
  useDocumentTitle(title)
  return <div className="mx-auto max-w-reading px-4 pt-8" />
}
