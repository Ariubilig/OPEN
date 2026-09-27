// The public story page, rendering a working copy exactly as readers would see it.
import { useEffect, useState } from 'react'
import type { RelatedItem } from '../components/RelatedStories'
import { fetchCardsByIds } from '../data/api'
import { StorySchema, type Story } from '../data/schema'
import { StoryPage } from '../routes/Story'
import { adminCopy } from './copy'
import { Notice } from './ui'
import { findingMessage } from './validation'
import { validateStory } from '../lib/validate'

const t = adminCopy.preview

export default function StoryPreview({ content }: { content: unknown }) {
  const parsed = StorySchema.safeParse(content)
  const story: Story | null = parsed.success ? parsed.data : null
  const [related, setRelated] = useState<RelatedItem[]>([])
  const ids = story?.relatedStoryIds?.join(',') ?? ''

  useEffect(() => {
    let cancelled = false
    fetchCardsByIds(ids ? ids.split(',') : []).then(
      (cards) => !cancelled && setRelated(cards),
      () => !cancelled && setRelated([]),
    )
    return () => {
      cancelled = true
    }
  }, [ids])

  if (!story) {
    const { errors } = validateStory(content)
    return (
      <Notice tone="warning">
        <p>{t.invalid}</p>
        <ul className="mt-2 list-disc pl-5">
          {errors.slice(0, 12).map((e, i) => (
            <li key={i}>
              <code className="text-meta">{e.path}</code> — {findingMessage(e)}
            </li>
          ))}
          {errors.length > 12 && <li>…</li>}
        </ul>
      </Notice>
    )
  }
  return (
    <div>
      <p className="mb-2 text-meta text-muted">{t.note}</p>
      {/* the page as it is on the site: paper background, reading widths, every section */}
      <div className="overflow-hidden rounded-card border border-line bg-paper pb-10">
        <StoryPage story={story} related={related} />
      </div>
    </div>
  )
}
