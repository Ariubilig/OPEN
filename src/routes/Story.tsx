import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router'
import AffectsBlock from '../components/AffectsBlock'
import Calculator from '../components/Calculator'
import ChangeBlock from '../components/ChangeBlock'
import DataText from '../components/DataText'
import EvidenceChain from '../components/EvidenceChain'
import KeyNumbers from '../components/KeyNumbers'
import MeaningBlock from '../components/MeaningBlock'
import NumberExplainer from '../components/NumberExplainer'
import ParticipateBlock from '../components/ParticipateBlock'
import Positions from '../components/Positions'
import RelatedStories, { relatedStories } from '../components/RelatedStories'
import SectionNav, { type NavItem } from '../components/SectionNav'
import SourceSheetProvider from '../components/SourceSheet'
import SourcesBlock from '../components/SourcesBlock'
import StoryHeader from '../components/StoryHeader'
import Timeline from '../components/Timeline'
import { APP_NAME, REPORT_EMAIL } from '../config'
import { copy } from '../copy'
import { getStory } from '../data'
import type { Story as StoryData } from '../data/schema'
import { formatDate } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import NotFound from './NotFound'

export default function Story() {
  const { id = '' } = useParams()
  const story = getStory(id)
  if (!story) return <NotFound />
  // key: a related-story link mounts a fresh page (nav state, open panels)
  return <StoryPage key={story.id} story={story} />
}

type SectionId =
  | 'changes'
  | 'key-numbers'
  | 'meaning'
  | 'affects'
  | 'calculator'
  | 'timeline'
  | 'sources'
  | 'evidence'
  | 'participate'

/** Sections in page order, only those this story has data for. */
function sectionsOf(story: StoryData): Record<SectionId, boolean> {
  return {
    changes: (story.changes?.length ?? 0) > 0,
    'key-numbers': (story.keyNumbers?.length ?? 0) > 0,
    meaning: story.meaning.length > 0 || (story.positions?.length ?? 0) > 0,
    affects: story.affects.length > 0,
    calculator: story.calculator === 'pit',
    timeline: story.timeline.length > 0,
    sources: story.sources.length > 0,
    // featured stories always show the chain; others once they have one item
    evidence: story.featured || story.evidence.some((e) => e.items.length > 0),
    participate: story.participate.length > 0,
  }
}

const NAV_LABELS: Record<SectionId, string> = {
  changes: copy.story.nav.changes,
  'key-numbers': copy.story.nav.keyNumbers,
  meaning: copy.story.nav.meaning,
  affects: copy.story.nav.affects,
  calculator: copy.story.nav.calculator,
  timeline: copy.story.nav.timeline,
  sources: copy.story.nav.sources,
  evidence: copy.story.nav.evidence,
  participate: copy.story.nav.participate,
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 pt-12"
    >
      <h2
        id={`${id}-title`}
        tabIndex={-1}
        className="mb-4 text-h2 focus:outline-none"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function StoryPage({ story }: { story: StoryData }) {
  useDocumentTitle(story.title)
  const has = sectionsOf(story)
  const navItems = useMemo<NavItem[]>(() => {
    const present = sectionsOf(story)
    return (Object.keys(present) as SectionId[])
      .filter((id) => present[id])
      .map((id) => ({ id, label: NAV_LABELS[id] }))
  }, [story])
  const related = relatedStories(story)

  return (
    <SourceSheetProvider story={story}>
      <article>
        <div className="mx-auto max-w-reading px-4">
          <StoryHeader story={story} />
        </div>

        {/* direct child of <article> so it stays sticky through every section */}
        <SectionNav items={navItems} />

        <div className="mx-auto max-w-reading px-4">
          {has.changes && (
            <Section id="changes" title={copy.story.sections.changes}>
              <div className="space-y-4">
                {story.changes!.map((c, i) => (
                  <ChangeBlock key={i} change={c} />
                ))}
              </div>
            </Section>
          )}

          {has['key-numbers'] && (
            <Section id="key-numbers" title={copy.story.sections.keyNumbers}>
              <KeyNumbers items={story.keyNumbers!} />
              {story.numberExplainer && (
                <NumberExplainer explainer={story.numberExplainer} />
              )}
            </Section>
          )}

          {has.meaning && (
            <Section id="meaning" title={copy.story.sections.meaning}>
              <MeaningBlock items={story.meaning} />
              {story.positions && story.positions.length > 0 && (
                <Positions items={story.positions} />
              )}
            </Section>
          )}

          {has.affects && (
            <Section id="affects" title={copy.story.sections.affects}>
              <AffectsBlock items={story.affects} />
            </Section>
          )}

          {has.calculator && (
            <Section id="calculator" title={copy.story.sections.calculator}>
              <Calculator />
            </Section>
          )}

          {has.timeline && (
            <Section id="timeline" title={copy.story.sections.timeline}>
              <Timeline items={story.timeline} />
            </Section>
          )}

          {has.sources && (
            <Section id="sources" title={copy.story.sections.sources}>
              <SourcesBlock story={story} />
            </Section>
          )}

          {has.evidence && (
            <Section id="evidence" title={copy.story.sections.evidence}>
              {/* wider than the reading column from 768px so four steps fit side by side */}
              <div className="md:relative md:left-1/2 md:w-[min(64rem,calc(100vw-2rem))] md:-translate-x-1/2">
                <EvidenceChain evidence={story.evidence} />
              </div>
            </Section>
          )}

          {has.participate && (
            <Section id="participate" title={copy.story.sections.participate}>
              <ParticipateBlock refs={story.participate} />
            </Section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-title" className="pt-12">
              <h2 id="related-title" className="mb-4 text-h2">
                {copy.story.sections.related}
              </h2>
              <RelatedStories stories={related} />
            </section>
          )}

          {story.corrections && story.corrections.length > 0 && (
            <section aria-labelledby="corrections-title" className="pt-12">
              <h2 id="corrections-title" className="mb-4 text-h2">
                {copy.story.sections.corrections}
              </h2>
              <ul className="space-y-2">
                {story.corrections.map((c, i) => (
                  <li key={i} className="flex gap-3">
                    <time
                      dateTime={c.date}
                      className="text-small text-muted tabular-nums"
                    >
                      {formatDate(c.date)}
                    </time>
                    <span>
                      <DataText value={c.text} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
            <p className="text-small font-semibold">{copy.story.disclaimer}</p>
            {REPORT_EMAIL && (
              <a
                href={`mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME}: ${story.title}`)}`}
                className="inline-flex min-h-11 items-center text-small font-semibold text-accent underline underline-offset-2"
              >
                {copy.story.reportError}
              </a>
            )}
          </div>
        </div>
      </article>
    </SourceSheetProvider>
  )
}
