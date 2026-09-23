import type { ReactNode } from 'react'
import Icon from '../components/Icon'
import NumberTag from '../components/NumberTag'
import { ChannelCard } from '../components/ParticipateBlock'
import SentenceLines from '../components/SentenceLines'
import { copy } from '../copy'
import { channels } from '../data'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type StepStatus = (typeof copy.about.steps)[number]['status']

// How far each pipeline step is built in the demo — shown honestly next to the step.
const STATUS_STYLES: Record<StepStatus, string> = {
  built: 'bg-ins-bg text-ins-ink',
  prepared: 'bg-accent-soft text-accent-strong',
  manual: 'bg-paper text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]',
  next: 'border border-dashed border-muted text-muted',
}

function Block({
  id,
  n,
  title,
  children,
}: {
  id: string
  n: number
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="pt-12 lg:pt-20">
      <div className="mb-5 flex items-center gap-3 lg:mb-7">
        <NumberTag n={n} />
        <h2 id={id} className="text-h2 lg:text-h2-lg">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

/** "d.parliament.mn — УИХ-д өргөн мэдүүлсэн төслүүд" → the name, then what it holds. */
function DataSource({ line }: { line: string }) {
  const [name, ...rest] = line.split(' — ')
  return (
    <li className="flex flex-col gap-0.5 rounded-card border border-line bg-surface px-4 py-3.5">
      <span className="font-bold break-words">{name}</span>
      {rest.length > 0 && (
        <span className="text-small text-ink-2">{rest.join(' — ')}</span>
      )}
    </li>
  )
}

export default function About() {
  useDocumentTitle(copy.about.title)
  const steps = copy.about.steps
  return (
    <div className="mx-auto max-w-page px-4 pt-8 md:px-8 md:pt-[72px]">
      <header className="grid gap-4 lg:grid-cols-[5fr_7fr] lg:gap-16">
        <h1 className="text-display lg:text-display-lg">{copy.about.title}</h1>
        <div className="flex flex-col gap-4 lg:pt-4">
          <p className="text-lede text-ink lg:text-[21px] lg:leading-[32px]">
            {copy.about.intro}
          </p>
          <p className="text-ink-2">{copy.about.position}</p>
        </div>
      </header>

      <p className="on-ink mt-9 flex items-start gap-3.5 rounded-card-lg bg-ink p-5 text-[22px] leading-[29px] font-extrabold tracking-[-0.025em] text-on-ink md:gap-4 md:p-8 md:text-[30px] md:leading-[38px] lg:mt-14 lg:text-[40px] lg:leading-[48px]">
        <Icon
          name="checkCircle"
          className="mt-0.5 size-6 text-highlight md:size-7 lg:mt-1.5 lg:size-9"
        />
        <span>
          <SentenceLines text={copy.principle} />
        </span>
      </p>

      <Block id="about-steps" n={1} title={copy.about.stepsTitle}>
        <ol className="rounded-card border border-line bg-surface px-4 py-2 md:px-6">
          {steps.map((step, i) => (
            <li
              key={step.name}
              className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3.5 py-4 md:grid-cols-[32px_minmax(0,1fr)_auto] md:gap-x-5"
            >
              {/* connector to the next step */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-[52px] -bottom-4 left-[15px] w-0.5 bg-line-strong"
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex size-8 items-center justify-center rounded-full text-meta font-extrabold tabular-nums ${
                  step.status === 'next'
                    ? 'border-2 border-dashed border-on-ink-3 bg-surface text-muted'
                    : 'bg-ink text-highlight'
                }`}
              >
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1 pt-[5px]">
                <h3 className="text-[17px] leading-[23px] font-bold tracking-normal">
                  {step.name}
                </h3>
                <p className="text-[15px] leading-[22px] text-ink-2">
                  {step.text}
                </p>
              </div>
              <p
                className={`col-start-2 mt-2.5 inline-flex h-7 items-center self-start justify-self-start rounded-full px-3 text-meta font-bold whitespace-nowrap md:col-start-3 md:row-start-1 md:mt-0.5 ${STATUS_STYLES[step.status]}`}
              >
                {step.demo}
              </p>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="about-principles" n={2} title={copy.about.principlesTitle}>
        <ol className="divide-y divide-line rounded-card border border-line bg-surface md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:border-0 md:bg-transparent lg:grid-cols-3">
          {copy.about.principles.map((p, i) => (
            <li
              key={p}
              className="flex gap-3.5 p-4 md:rounded-card md:border md:border-line md:bg-surface md:p-5 md:last:col-span-2 lg:last:col-span-3"
            >
              <span
                aria-hidden="true"
                className="text-[22px] leading-7 font-extrabold text-accent tabular-nums"
              >
                {i + 1}
              </span>
              <p className="pt-0.5 text-[16px] leading-[25px]">{p}</p>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="about-channels" n={3} title={copy.about.channelsTitle}>
        <ul className="grid gap-3 md:grid-cols-2 md:[&>li:last-child:nth-child(odd)]:col-span-2">
          {channels.map((c) => (
            <ChannelCard
              key={c.id}
              channel={c}
              label={copy.about.openChannel}
              href={c.url}
            />
          ))}
        </ul>
      </Block>

      <Block id="about-data" n={4} title={copy.about.dataTitle}>
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {copy.about.data.map((d) => (
            <DataSource key={d} line={d} />
          ))}
        </ul>
      </Block>

      <p className="mt-12 flex items-start gap-2.5 rounded-card border border-line bg-surface p-4 text-[15px] leading-[22px] font-semibold lg:mt-20">
        <Icon name="info" className="size-5" />
        {copy.footer.prototype}
      </p>
    </div>
  )
}
