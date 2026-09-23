import { copy } from '../copy'
import { getChannel } from '../data'
import { TODO, type Channel, type ParticipateRef } from '../data/schema'
import DataText from './DataText'
import ExternalLink from './ExternalLink'
import Icon from './Icon'

/** The label with its last word and the icon kept together, so a wrapped button stays tidy. */
function ButtonLabel({ label }: { label: string }) {
  const cut = label.lastIndexOf(' ') + 1
  return (
    <span>
      <DataText value={label.slice(0, cut)} />
      <span className="whitespace-nowrap">
        <DataText value={label.slice(cut)} />
        <Icon
          name="externalLink"
          className="ml-2 inline size-4 align-[-0.125em]"
        />
      </span>
      <span className="sr-only"> ({copy.a11y.newTab})</span>
    </span>
  )
}

/**
 * One official channel: name, description (with its source), and a button that opens the
 * channel in a new tab. No button while the channel has no link yet.
 * tone "dark" sits on the ink participate block of a story; "light" on the About page.
 */
export function ChannelCard({
  channel,
  label,
  href,
  note,
  tone = 'light',
}: {
  channel: Channel
  label: string
  href: string | null
  note?: string
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <li
      className={`flex flex-col gap-2.5 rounded-card border p-[18px] ${
        dark ? 'border-ink-line bg-ink-raised' : 'border-line bg-surface'
      }`}
    >
      <h3
        className={`text-[17px] leading-[23px] font-bold tracking-[-0.01em] ${dark ? 'text-on-ink' : ''}`}
      >
        <DataText value={channel.name} />
      </h3>
      <p
        className={`text-small leading-[21px] ${dark ? 'text-on-ink-2' : 'text-ink-2'}`}
      >
        <DataText value={channel.description} />
      </p>
      {note && (
        <p className={`text-meta ${dark ? 'text-on-ink-3' : 'text-muted'}`}>
          <DataText value={note} />
        </p>
      )}
      <p
        className={`flex items-baseline gap-x-1.5 text-meta ${dark ? 'text-on-ink-3' : 'text-muted'}`}
      >
        <span className="shrink-0">{copy.participate.source}:</span>
        <ExternalLink
          href={channel.source.url}
          tone={dark ? 'highlight' : 'accent'}
        >
          {channel.source.publisher}
        </ExternalLink>
      </p>
      {href && href !== TODO && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-auto flex min-h-[52px] items-center justify-center rounded-full py-2 text-center text-[15px] leading-5 font-bold transition-colors ${
            dark
              ? 'bg-highlight px-[18px] text-ink hover:bg-white'
              : 'bg-ink px-6 text-white hover:bg-accent-strong sm:self-start'
          }`}
        >
          <ButtonLabel label={label} />
        </a>
      )}
    </li>
  )
}

/** Official channels to respond through, with the story-specific action label. */
export default function ParticipateBlock({ refs }: { refs: ParticipateRef[] }) {
  return (
    <>
      <p className="text-[16px] leading-[25px] text-on-ink-2">
        {copy.participate.intro}
      </p>
      <ul className="mt-1 flex flex-col gap-3">
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
              tone="dark"
            />
          )
        })}
      </ul>
    </>
  )
}
