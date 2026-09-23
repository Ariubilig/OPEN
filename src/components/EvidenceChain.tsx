import { copy } from '../copy'
import { EVIDENCE_STEPS, type EvidenceStep } from '../data/schema'
import CitedText from './CitedText'

/**
 * Бодлого → Төсөв → Үр нөлөөний үнэлгээ → Олон нийтийн санал, always all four in this order.
 * An empty step says so: a visible gap is information too.
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
    <ol>
      {steps.map(({ step, items }, i) => {
        const found = items.length > 0
        const last = i === steps.length - 1
        return (
          <li
            key={step}
            className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-3.5 pb-[22px] last:pb-0"
          >
            {/* connector to the next step */}
            {!last && (
              <span
                aria-hidden="true"
                className="absolute top-9 bottom-1 left-[15px] w-0.5 bg-line-strong"
              />
            )}
            <span
              aria-hidden="true"
              className={`relative flex size-8 items-center justify-center rounded-full text-meta font-extrabold tabular-nums ${
                found
                  ? 'bg-ink text-highlight'
                  : 'border-2 border-dashed border-on-ink-3 bg-paper text-muted'
              }`}
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5 pt-[5px]">
              <h3 className="text-[16px] leading-[22px] font-bold tracking-normal">
                {step}
              </h3>
              {found ? (
                items.map((item, j) => (
                  <p key={j} className="text-[15px] leading-[23px]">
                    <CitedText cited={item} />
                  </p>
                ))
              ) : (
                <p className="text-[15px] leading-[23px] text-muted">
                  {copy.story.notFoundYet}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
