import type { ReactNode } from 'react'
import { copy } from '../copy'
import { TODO } from '../data/schema'
import Icon from './Icon'
import Placeholder from './Placeholder'

/** Outbound link: new tab, no opener, no referrer. A TODO_VERIFY url renders a placeholder. */
export default function ExternalLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  if (href === TODO) return <Placeholder />
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent underline underline-offset-2 hover:no-underline ${className}`}
    >
      {children}
      <Icon name="externalLink" className="size-3.5" />
      <span className="sr-only"> ({copy.a11y.newTab})</span>
    </a>
  )
}
