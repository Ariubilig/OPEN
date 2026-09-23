import { Link } from 'react-router'
import { copy } from '../copy'
import { stories } from '../data'
import type { Affect, Group, Story } from '../data/schema'
import { groupCounts, storiesFor } from '../lib/groups'
import { TypeLabel } from './Badge'
import Chip from './Chip'
import CitedText from './CitedText'
import DataText from './DataText'
import Icon from './Icon'
import SourceSheetProvider from './SourceSheet'

const counts = groupCounts(stories)

function storyLink(story: Story, group: Group) {
  return `/story/${story.id}?group=${encodeURIComponent(group)}`
}

/** One story that affects the chosen group: its title, then exactly what it says for the group. */
function ForYouCard({
  story,
  affects,
  group,
}: {
  story: Story
  affects: Affect[]
  group: Group
}) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-card bg-paper p-4 lg:p-6">
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <TypeLabel type={story.type} />
        <span aria-hidden="true" className="text-muted">
          ·
        </span>
        <span className="text-meta font-semibold">{story.stage}</span>
      </p>
      <h3 className="text-[18px] leading-6 font-bold tracking-[-0.015em] text-pretty lg:text-[21px] lg:leading-7">
        <Link
          to={storyLink(story, group)}
          className="text-ink hover:text-accent-strong"
        >
          <DataText value={story.title} />
        </Link>
      </h3>
      <ul className="flex flex-col gap-2.5 border-t border-line pt-3">
        {affects.map((a, i) => (
          <li
            key={i}
            className="grid grid-cols-[8px_minmax(0,1fr)] gap-x-3 text-[16px] leading-[25px]"
          >
            <span
              aria-hidden="true"
              className="mt-2.5 size-2 rounded-[2px] bg-highlight shadow-[inset_0_0_0_1.5px_var(--ink)]"
            />
            <span>
              <CitedText cited={a} />
            </span>
          </li>
        ))}
      </ul>
      <Link
        to={storyLink(story, group)}
        className="mt-auto inline-flex min-h-11 items-center gap-1.5 self-start text-small font-semibold text-accent hover:text-accent-strong"
      >
        {copy.forYou.open}
        <Icon name="arrowRight" className="size-4" />
        <span className="sr-only">: {story.title}</span>
      </Link>
    </article>
  )
}

/**
 * "Танд юу хамаатай вэ?": pick a group (Оюутан, Ажилтан …) and see, story by story, the cited
 * sentences that say what changes for that group. Every sentence keeps its source marker.
 */
export default function ForYou({
  group,
  onSelect,
}: {
  group: Group | null
  onSelect: (group: Group | null) => void
}) {
  if (counts.length === 0) return null
  const results = group ? storiesFor(stories, group) : []
  return (
    <section
      aria-labelledby="for-you-title"
      className="mt-10 rounded-card-lg border border-line bg-surface p-5 lg:mt-[72px] lg:p-8"
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:items-start lg:gap-12">
        <div>
          <h2
            id="for-you-title"
            className="text-[22px] leading-7 lg:text-[28px] lg:leading-[34px]"
          >
            {copy.forYou.title}
          </h2>
          <p className="mt-1.5 text-ink-2">{copy.forYou.hint}</p>
        </div>
        <div
          role="group"
          aria-label={copy.forYou.title}
          className="-mx-5 mt-3.5 flex gap-2 overflow-x-auto px-5 py-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 lg:mt-1 [&::-webkit-scrollbar]:hidden"
        >
          {counts.map(({ group: g, count }) => (
            <Chip
              key={g}
              tone="soft"
              selected={group === g}
              onClick={() => onSelect(group === g ? null : g)}
            >
              {g}
              <span
                className={`ml-1.5 tabular-nums ${group === g ? 'text-highlight' : 'text-muted'}`}
              >
                {count}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {group ? `${group} · ${copy.feed.count(results.length)}` : ''}
      </p>
      <div>
        {group && (
          <>
            <div className="mt-4 flex items-center justify-between gap-3 lg:mt-6">
              <p className="text-small font-semibold text-ink-2 tabular-nums">
                {group} · {copy.feed.count(results.length)}
              </p>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="-my-1.5 inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-accent underline underline-offset-3 hover:no-underline"
              >
                <Icon name="close" className="size-4" />
                {copy.forYou.clear}
              </button>
            </div>
            <ul className="mt-2 grid gap-3 md:grid-cols-2 lg:gap-5">
              {results.map(({ story, affects }) => (
                <li key={story.id}>
                  <SourceSheetProvider story={story}>
                    <ForYouCard story={story} affects={affects} group={group} />
                  </SourceSheetProvider>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
