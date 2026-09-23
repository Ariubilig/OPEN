import { Link, useLocation, useNavigate } from 'react-router'
import { copy } from '../copy'
import { TODO, type Story } from '../data/schema'
import { formatDate } from '../lib/format'
import { BadgeRow } from './Badge'
import CitedText from './CitedText'
import DataText from './DataText'
import Icon from './Icon'

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
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-small font-semibold text-accent hover:bg-accent-soft"
    >
      <Icon name="arrowLeft" />
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
    <header className="pt-4">
      <BackLink />
      <div className="mt-3">
        <BadgeRow type={story.type} stage={story.stage} />
      </div>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {story.topics.map((topic) => (
          <li
            key={topic}
            className="rounded-full bg-surface px-2 py-0.5 text-small text-muted ring-1 ring-line ring-inset"
          >
            {topic}
          </li>
        ))}
      </ul>

      <h1 className="mt-4 text-h1 md:text-h1-lg">
        <DataText value={story.title} />
      </h1>

      <p className="mt-3 text-small text-muted">
        <span className="font-semibold">{copy.story.officialTitle}: </span>
        <CitedText cited={story.officialTitle} />
      </p>

      <p className="mt-5 text-[19px] leading-[30px]">
        <CitedText cited={story.summary} />
      </p>

      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-small text-muted tabular-nums">
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
    </header>
  )
}
