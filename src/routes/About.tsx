import type { ReactNode } from 'react'
import { ChannelCard } from '../components/ParticipateBlock'
import { copy } from '../copy'
import { channels } from '../data'
import { useDocumentTitle } from '../lib/useDocumentTitle'

type StepStatus = (typeof copy.about.steps)[number]['status']

// How far each pipeline step is built in the demo — shown honestly next to the step.
const STATUS_STYLES: Record<StepStatus, string> = {
  built: 'bg-ins-bg text-ins-ink',
  prepared: 'bg-accent-soft text-accent',
  manual: 'bg-paper text-ink ring-1 ring-line ring-inset',
  next: 'border border-dashed border-muted/60 text-muted',
}

function Block({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="pt-10">
      <h2 id={id} className="mb-4 text-h2">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function About() {
  useDocumentTitle(copy.about.title)
  return (
    <div className="mx-auto max-w-reading px-4 pt-8">
      <h1 className="text-h1 md:text-h1-lg">{copy.about.title}</h1>
      <p className="mt-4 text-[19px] leading-[30px]">{copy.about.intro}</p>
      <p className="mt-4">{copy.about.position}</p>
      <p className="mt-4 font-semibold">{copy.principle}</p>

      <Block id="about-steps" title={copy.about.stepsTitle}>
        <ol className="space-y-3">
          {copy.about.steps.map((step, i) => (
            <li
              key={step.name}
              className="flex gap-3 rounded-card border border-line bg-surface p-4"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-small font-semibold text-white tabular-nums"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-sans text-body font-semibold">
                  {step.name}
                </h3>
                <p className="text-small">{step.text}</p>
                <p
                  className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-small font-semibold ${STATUS_STYLES[step.status]}`}
                >
                  {step.demo}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <Block id="about-principles" title={copy.about.principlesTitle}>
        <ol className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-muted">
          {copy.about.principles.map((p) => (
            <li key={p} className="pl-1">
              {p}
            </li>
          ))}
        </ol>
      </Block>

      <Block id="about-channels" title={copy.about.channelsTitle}>
        <ul className="space-y-3">
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

      <Block id="about-data" title={copy.about.dataTitle}>
        <ul className="list-disc space-y-1.5 pl-6 marker:text-muted">
          {copy.about.data.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Block>

      <p className="mt-10 rounded-card border border-line bg-surface p-4 text-small font-semibold">
        {copy.footer.prototype}
      </p>
    </div>
  )
}
