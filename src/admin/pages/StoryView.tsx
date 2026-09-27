// A working copy as readers would see it (replaced by the editor in phase 5).
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { adminCopy } from '../copy'
import StoryPreview from '../StoryPreview'
import { maybe, supabase } from '../supabase'
import { PageHeader, StateBadge } from '../ui'

export async function loader({ params }: LoaderFunctionArgs) {
  const story = await maybe(
    supabase
      .from('stories')
      .select('id, content, state, version')
      .eq('id', params.id ?? '')
      .maybeSingle(),
  )
  if (!story) throw new Error('not_found')
  return { story }
}

export function Component() {
  const { story } = useLoaderData() as Awaited<ReturnType<typeof loader>>
  const title = (story.content as { title?: string }).title ?? story.id
  useDocumentTitle(`${title} · ${adminCopy.title}`)
  return (
    <div className="flex flex-col gap-5">
      <Link to="/admin" className="text-small font-semibold text-accent">
        ← {adminCopy.nav.stories}
      </Link>
      <PageHeader title={title}>
        <StateBadge state={story.state} />
      </PageHeader>
      <StoryPreview content={story.content} />
    </div>
  )
}
