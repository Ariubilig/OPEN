import { useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router'
import AffectsBlock from '../components/AffectsBlock'
import Calculator from '../components/Calculator'
import ChangeBlock from '../components/ChangeBlock'
import DataText from '../components/DataText'
import EvidenceChain from '../components/EvidenceChain'
import Icon from '../components/Icon'
import KeyNumbers from '../components/KeyNumbers'
import MeaningBlock from '../components/MeaningBlock'
import NumberExplainer from '../components/NumberExplainer'
import ParticipateBlock from '../components/ParticipateBlock'
import Positions from '../components/Positions'
import RelatedStories, { relatedStories } from '../components/RelatedStories'
import SectionNav, { goToSection, type NavItem } from '../components/SectionNav'
import SourceSheetProvider from '../components/SourceSheet'
import SourcesBlock from '../components/SourcesBlock'
import StageCard from '../components/StageCard'
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
  | 'calculator'
  | 'key-numbers'
  | 'meaning'
  | 'affects'
  | 'timeline'
  | 'sources'
  | 'evidence'
  | 'participate'

/** Page order. The calculator sits right after the changes: it is the most personal part. */
const ORDER: SectionId[] = [
  'changes',
  'calculator',
  'key-numbers',
  'meaning',
  'affects',
  'timeline',
  'sources',
  'evidence',
  'participate',
]

/** Which sections this story has data for. */
function sectionsOf(story: StoryData): Record<SectionId, boolean> {
  return {
    changes: (story.changes?.length ?? 0) > 0,
    calculator: story.calculator === 'pit',
    'key-numbers': (story.keyNumbers?.length ?? 0) > 0,
    meaning: story.meaning.length > 0 || (story.positions?.length ?? 0) > 0,
    affects: story.affects.length > 0,
    timeline: story.timeline.length > 0,
    sources: story.sources.length > 0,
    // featured stories always show the chain; others once they have one item
    evidence: story.featured || story.evidence.some((e) => e.items.length > 0),
    participate: story.participate.length > 0,
  }
}

const NAV_LABELS: Record<SectionId, string> = {
  changes: copy.story.nav.changes,
  calculator: copy.story.nav.calculator,
  'key-numbers': copy.story.nav.keyNumbers,
  meaning: copy.story.nav.meaning,
  affects: copy.story.nav.affects,
  timeline: copy.story.nav.timeline,
  sources: copy.story.nav.sources,
  evidence: copy.story.nav.evidence,
  participate: copy.story.nav.participate,
}

/** Section with a numbered tag ("01") and its question as the heading. */
function Section({
  id,
  number,
  title,
  children,
  dark = false,
}: {
  id: string
  number: number
  title: string
  children: ReactNode
  dark?: boolean
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-16 lg:scroll-mt-6 ${
        dark
          ? 'on-ink -mx-4 mt-11 bg-ink px-4 pt-9 pb-9 text-on-ink md:mx-0 md:rounded-card-lg md:px-7 md:pt-8 md:pb-8 lg:mt-16'
          : 'pt-11 lg:pt-16'
      }`}
    >
      <div className="mb-[18px] flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-6 w-[30px] shrink-0 items-center justify-center rounded-[7px] text-overline font-extrabold tabular-nums ${
            dark ? 'bg-highlight text-ink' : 'bg-ink text-highlight'
          }`}
        >
          {String(number).padStart(2, '0')}
        </span>
        <h2
          id={`${id}-title`}
          tabIndex={-1}
          className="text-h2 focus:outline-none lg:text-h2-lg"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

/** "Санал бодлоо илэрхийлэх": jumps to the official channels at the end of the story. */
function ParticipateButton() {
  return (
    <a
      href="#participate"
      onClick={(e) => {
        e.preventDefault()
        goToSection('participate')
      }}
      className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-ink px-[22px] font-semibold text-white transition-colors hover:bg-accent-strong"
    >
      <Icon name="voice" className="size-5" />
      {copy.story.sections.participate}
    </a>
  )
}

function StoryPage({ story }: { story: StoryData }) {
  useDocumentTitle(story.title)
  const has = sectionsOf(story)
  const navItems = useMemo<NavItem[]>(() => {
    const present = sectionsOf(story)
    return ORDER.filter((id) => present[id]).map((id) => ({
      id,
      label: NAV_LABELS[id],
    }))
  }, [story])
  const number = (id: SectionId) => navItems.findIndex((i) => i.id === id) + 1
  const related = relatedStories(story)
  const summary = (
    <>
      <StageCard story={story} />
      {has.participate && <ParticipateButton />}
    </>
  )

  return (
    <SourceSheetProvider story={story}>
      <article className="mx-auto max-w-page px-4 md:px-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_392px] xl:gap-x-[72px]">
        <div className="mx-auto w-full max-w-reading min-w-0 lg:max-w-none">
          <StoryHeader story={story} />

          <div className="mt-5 flex flex-col gap-[18px] lg:hidden">
            {summary}
          </div>

          {/* direct child of the column so it stays sticky through every section (phones, tablets) */}
          <SectionNav items={navItems} className="lg:hidden" />

          {has.changes && (
            <Section
              id="changes"
              number={number('changes')}
              title={copy.story.sections.changes}
            >
              <div className="flex flex-col gap-3.5">
                {story.changes!.map((c, i) => (
                  <ChangeBlock key={i} change={c} />
                ))}
              </div>
            </Section>
          )}

          {has.calculator && (
            <Section
              id="calculator"
              number={number('calculator')}
              title={copy.story.sections.calculator}
            >
              <Calculator />
            </Section>
          )}

          {has['key-numbers'] && (
            <Section
              id="key-numbers"
              number={number('key-numbers')}
              title={copy.story.sections.keyNumbers}
            >
              <KeyNumbers items={story.keyNumbers!} />
              {story.numberExplainer && (
                <NumberExplainer explainer={story.numberExplainer} />
              )}
            </Section>
          )}

          {has.meaning && (
            <Section
              id="meaning"
              number={number('meaning')}
              title={copy.story.sections.meaning}
            >
              <MeaningBlock items={story.meaning} />
              {story.positions && story.positions.length > 0 && (
                <Positions items={story.positions} />
              )}
            </Section>
          )}

          {has.affects && (
            <Section
              id="affects"
              number={number('affects')}
              title={copy.story.sections.affects}
            >
              <AffectsBlock items={story.affects} />
            </Section>
          )}

          {has.timeline && (
            <Section
              id="timeline"
              number={number('timeline')}
              title={copy.story.sections.timeline}
            >
              <Timeline items={story.timeline} />
            </Section>
          )}

          {has.sources && (
            <Section
              id="sources"
              number={number('sources')}
              title={copy.story.sections.sources}
            >
              <SourcesBlock story={story} />
            </Section>
          )}

          {has.evidence && (
            <Section
              id="evidence"
              number={number('evidence')}
              title={copy.story.sections.evidence}
            >
              <EvidenceChain evidence={story.evidence} />
            </Section>
          )}

          {has.participate && (
            <Section
              id="participate"
              number={number('participate')}
              title={copy.story.sections.participate}
              dark
            >
              <ParticipateBlock refs={story.participate} />
            </Section>
          )}

          {related.length > 0 && (
            <section aria-labelledby="related-title" className="pt-10 lg:pt-14">
              <h2
                id="related-title"
                className="mb-4 text-[22px] leading-7 lg:text-h2-lg"
              >
                {copy.story.sections.related}
              </h2>
              <RelatedStories stories={related} />
            </section>
          )}

          {story.corrections && story.corrections.length > 0 && (
            <section
              aria-labelledby="corrections-title"
              className="pt-10 lg:pt-14"
            >
              <h2
                id="corrections-title"
                className="mb-4 text-[22px] leading-7 lg:text-h2-lg"
              >
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

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 lg:mt-12">
            <p className="flex items-start gap-2.5 text-[15px] leading-[22px] font-semibold">
              <Icon name="info" className="size-5" />
              {copy.story.disclaimer}
            </p>
            {REPORT_EMAIL && (
              <a
                href={`mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(`${APP_NAME}: ${story.title}`)}`}
                className="inline-flex min-h-11 items-center text-small font-semibold text-accent underline underline-offset-3"
              >
                {copy.story.reportError}
              </a>
            )}
          </div>
        </div>

        {/* wide screens: where it is, the button and the section list stay in view */}
        <aside className="hidden lg:block lg:pt-[84px]">
          <div className="sticky top-6 flex flex-col gap-3.5">
            {summary}
            <SectionNav items={navItems} variant="list" />
          </div>
        </aside>
      </article>
    </SourceSheetProvider>
  )
}
