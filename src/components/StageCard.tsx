import { useId } from 'react'
import { copy } from '../copy'
import type { Story } from '../data/schema'
import { stageSummary } from '../lib/timeline'
import Icon from './Icon'
import { goToSection } from './SectionNav'
import { NextStep, StageTracker, StepDate, StepLabel } from './Stage'

/**
 * "Хаана явж байна?" at the top of a story: the stage tracker, where the document is now,
 * and the next step with its countdown. The full timeline stays in its own section.
 */
export default function StageCard({ story }: { story: Story }) {
  const titleId = useId()
  const { current, next } = stageSummary(story.timeline)
  if (!current && !next) return null
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface px-[18px] pt-[18px] pb-5"
    >
      <div className="-my-1.5 flex items-center justify-between gap-3">
        <p id={titleId} className="font-bold">
          {copy.story.sections.timeline}
        </p>
        <a
          href="#timeline"
          onClick={(e) => {
            e.preventDefault()
            goToSection('timeline')
          }}
          className="-mr-1 inline-flex min-h-11 items-center gap-1 px-1 text-small font-semibold text-accent hover:text-accent-strong"
        >
          {copy.story.allStages}
          <Icon name="arrowDown" className="size-4" />
        </a>
      </div>
      <StageTracker timeline={story.timeline} size="lg" />
      <div className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 gap-y-4">
        {current && (
          <>
            <span
              aria-hidden="true"
              className="mt-px size-3.5 rounded-full bg-highlight shadow-[inset_0_0_0_2.5px_var(--ink)]"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="eyebrow flex flex-wrap gap-x-1.5 text-muted tabular-nums">
                <span>{copy.timeline.here}</span>
                <span aria-hidden="true">·</span>
                <StepDate item={current} />
              </p>
              <p className="font-semibold">
                <StepLabel item={current} cite />
              </p>
            </div>
          </>
        )}
        {next && (
          <>
            <span
              aria-hidden="true"
              className="mt-px size-3.5 rounded-full border-2 border-dashed border-on-ink-3"
            />
            <NextStep timeline={story.timeline} cite />
          </>
        )}
      </div>
    </section>
  )
}
