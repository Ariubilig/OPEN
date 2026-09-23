import { copy } from '../copy'
import { getChannel } from '../data'
import { TODO, type Channel, type ParticipateRef } from '../data/schema'
import DataText from './DataText'
import ExternalLink from './ExternalLink'
import Icon from './Icon'

/**
 * One official channel: name, description (with its source), and a button that opens the
 * channel in a new tab. No button while the channel has no link yet.
 */
export function ChannelCard({
  channel,
  label,
  href,
  note,
}: {
  channel: Channel
  label: string
  href: string | null
  note?: string
}) {
  return (
    <li className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <h3 className="font-sans text-body font-semibold">
        <DataText value={channel.name} />
      </h3>
      <p className="text-small">
        <DataText value={channel.description} />
      </p>
      {note && (
        <p className="text-small text-muted">
          <DataText value={note} />
        </p>
      )}
      <p className="text-small text-muted">
        {copy.participate.source}:{' '}
        <ExternalLink href={channel.source.url}>
          {channel.source.publisher}
        </ExternalLink>
      </p>
      {href && href !== TODO && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-accent px-5 py-2 text-small font-semibold text-white hover:bg-ink"
        >
          <DataText value={label} />
          <Icon name="externalLink" className="size-4" />
          <span className="sr-only"> ({copy.a11y.newTab})</span>
        </a>
      )}
    </li>
  )
}

/** Official channels to respond through, with the story-specific action label. */
export default function ParticipateBlock({ refs }: { refs: ParticipateRef[] }) {
  return (
    <>
      <p>{copy.participate.intro}</p>
      <ul className="mt-4 space-y-3">
        {refs.map((ref, i) => {
          const channel = getChannel(ref.channel)
          if (!channel) return null
          return (
            <ChannelCard
              key={i}
              channel={channel}
              label={ref.label}
              href={ref.url ?? channel.url}
              note={ref.note}
            />
          )
        })}
      </ul>
    </>
  )
}
