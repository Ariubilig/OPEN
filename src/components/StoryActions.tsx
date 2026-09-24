import { useEffect, useRef, useState } from 'react'
import { APP_NAME } from '../config'
import { copy } from '../copy'
import { TODO, type Story } from '../data/schema'
import { toggleFollow, useFollowing } from '../lib/following'
import Icon from './Icon'

const BUTTON =
  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-small font-semibold transition-colors'

/**
 * "Дагах" keeps the story in the feed's "Дагаж буй" list (this browser only).
 * "Хуваалцах" opens the phone's share sheet, or copies the link where there is none.
 */
export default function StoryActions({ story }: { story: Story }) {
  const followed = useFollowing().includes(story.id)
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function say(text: string) {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 4000)
  }

  async function share() {
    const url = `${window.location.origin}/story/${story.id}`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: story.title.includes(TODO)
            ? APP_NAME
            : `${story.title} — ${APP_NAME}`,
          url,
        })
        return
      } catch (e) {
        // closed by the reader: nothing to say; any other failure falls back to copying
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      say(copy.share.copied)
    } catch {
      say(copy.share.failed)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            say(
              toggleFollow(story.id)
                ? copy.following.added
                : copy.following.removed,
            )
          }
          className={`${BUTTON} ${
            followed
              ? 'border-ink bg-highlight text-ink'
              : 'border-line-strong bg-surface text-ink hover:border-ink'
          }`}
        >
          <Icon name="bookmark" filled={followed} className="size-[18px]" />
          {followed ? copy.following.followed : copy.following.follow}
        </button>
        <button
          type="button"
          onClick={share}
          className={`${BUTTON} border-line-strong bg-surface text-ink hover:border-ink`}
        >
          <Icon name="share" className="size-[18px]" />
          {copy.share.label}
        </button>
      </div>
      <p role="status" className="text-meta font-semibold text-ink-2">
        {message}
      </p>
    </div>
  )
}
