import { Link, useLocation, useNavigate } from 'react-router'
import { copy } from '../copy'
import { TODO, type Story } from '../data/schema'
import { formatDate } from '../lib/format'
import { BadgeRow } from './Badge'
import CitedText from './CitedText'
import DataText from './DataText'
import Icon from './Icon'
import StoryActions from './StoryActions'

function BackLink() {
  const navigate = useNavigate()
  const location = useLocation()
  // Back to wherever the reader came from (keeps feed filters); the feed when opened directly.
  const hasHistory = location.key !== 'default'
  return (
    <Link
      to="/"
      onClick={(e) => {
        if (!hasHistory) return
        e.preventDefault()
        navigate(-1)
      }}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full pr-2.5 pl-2 text-small font-semibold text-ink hover:bg-surface"
    >
      <Icon name="arrowLeft" className="size-[18px]" />
      {copy.story.back}
    </Link>
  )
}

export default function StoryHeader({ story }: { story: Story }) {
  const reviewed =
    story.reviewed && story.reviewed.by !== TODO && story.reviewed.date !== TODO
      ? story.reviewed
      : undefined

  return (
    <header className="flex flex-col gap-4 pt-1.5 lg:pt-5">
      <BackLink />
      <div className="-mt-1 -mb-1 lg:mt-0">
        <BadgeRow type={story.type} stage={story.stage} />
      </div>
      <p className="text-small text-muted">{story.topics.join(' · ')}</p>

      <h1 className="mt-0.5 text-h1 lg:text-h1-lg">
        <DataText value={story.title} highlight="mark" />
      </h1>

      <p className="text-lede lg:text-[21px] lg:leading-8">
        <CitedText cited={story.summary} />
      </p>

      {/* no official title yet: no empty disclosure */}
      {story.officialTitle.text !== TODO && (
        <details className="group border-y border-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-small font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
            {copy.story.officialTitle}
            <Icon
              name="chevronDown"
              className="size-[18px] text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="mb-3.5 text-small leading-[21px] text-ink-2">
            <CitedText cited={story.officialTitle} />
          </p>
        </details>
      )}

      <dl className="-mt-1 flex flex-wrap gap-x-5 gap-y-1 text-meta text-muted tabular-nums">
        <div className="flex gap-1">
          <dt>{copy.story.published}:</dt>
          <dd>{formatDate(story.publishedAt)}</dd>
        </div>
        {story.updatedAt && (
          <div className="flex gap-1">
            <dt>{copy.story.updated}:</dt>
            <dd>{formatDate(story.updatedAt)}</dd>
          </div>
        )}
        {reviewed && (
          <div className="flex gap-1">
            <dt>{copy.story.reviewed}:</dt>
            <dd>
              {reviewed.by}, {formatDate(reviewed.date)}
            </dd>
          </div>
        )}
      </dl>

      <StoryActions story={story} />
    </header>
  )
}
