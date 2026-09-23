import { useId } from 'react'
import type { Story } from '../data/schema'
import CitedText from './CitedText'
import DataText from './DataText'

/** Callout that answers a confusing-number question, e.g. "45.7 үү, 41.3 үү?". */
export default function NumberExplainer({
  explainer,
}: {
  explainer: NonNullable<Story['numberExplainer']>
}) {
  const titleId = useId()
  return (
    <aside
      aria-labelledby={titleId}
      className="mt-4 rounded-card bg-accent-soft p-4 md:p-5"
    >
      <h3 id={titleId} className="text-[19px] leading-[26px]">
        <DataText value={explainer.question} />
      </h3>
      <div className="mt-2 space-y-2">
        {explainer.paragraphs.map((p, i) => (
          <p key={i}>
            <CitedText cited={p} />
          </p>
        ))}
      </div>
    </aside>
  )
}
