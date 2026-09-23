import type { ReactNode } from 'react'
import { copy } from '../copy'
import { TODO } from '../data/schema'
import Icon from './Icon'
import Placeholder from './Placeholder'

/**
 * Outbound link: new tab, no opener, no referrer. A TODO_VERIFY url renders a placeholder.
 * The icon sits inline after the last word, so a long title wraps naturally.
 * tone "highlight" is for ink surfaces.
 */
export default function ExternalLink({
  href,
  children,
  className = '',
  tone = 'accent',
}: {
  href: string
  children: ReactNode
  className?: string
  tone?: 'accent' | 'highlight'
}) {
  if (href === TODO) return <Placeholder />
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center font-semibold underline underline-offset-3 hover:no-underline ${
        tone === 'highlight' ? 'text-highlight' : 'text-accent'
      } ${className}`}
    >
      <span>
        {children}
        <Icon
          name="externalLink"
          className="ml-1.5 inline size-3.5 align-[-0.125em]"
        />
        <span className="sr-only"> ({copy.a11y.newTab})</span>
      </span>
    </a>
  )
}
