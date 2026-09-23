import { copy } from '../copy'
import { EVIDENCE_STEPS, type EvidenceStep } from '../data/schema'
import CitedText from './CitedText'

/**
 * Бодлого → Төсөв → Үр нөлөөний үнэлгээ → Олон нийтийн санал, always all four in this order.
 * Vertical on phones, horizontal from 768px. An empty step says so: a visible gap is information too.
 */
export default function EvidenceChain({
  evidence,
}: {
  evidence: EvidenceStep[]
}) {
  const steps = EVIDENCE_STEPS.map((step) => ({
    step,
    items: evidence.filter((e) => e.step === step).flatMap((e) => e.items),
  }))

  return (
    <ol className="md:grid md:grid-cols-4 md:gap-5">
      {steps.map(({ step, items }, i) => {
        const found = items.length > 0
        const last = i === steps.length - 1
        return (
          <li
            key={step}
            className="relative pb-6 pl-11 md:pt-11 md:pb-0 md:pl-0"
          >
            {/* connector to the next step */}
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-8 bottom-0 left-[15px] w-0.5 bg-line md:top-[15px] md:right-[-1.25rem] md:bottom-auto md:left-8 md:h-0.5 md:w-auto"
              />
            )}
            <span
              aria-hidden="true"
              className={`absolute top-0 left-0 flex size-8 items-center justify-center rounded-full text-small font-semibold tabular-nums ${
                found
                  ? 'bg-accent text-white'
                  : 'border-2 border-dashed border-muted/60 bg-paper text-muted'
              }`}
            >
              {i + 1}
            </span>
            <h3 className="pt-1 font-sans text-body font-semibold md:pt-0">
              {step}
            </h3>
            {found ? (
              <ul className="mt-1 space-y-2 md:text-small">
                {items.map((item, j) => (
                  <li key={j}>
                    <CitedText cited={item} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted md:text-small">
                {copy.story.notFoundYet}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
