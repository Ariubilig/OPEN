import type { Cited } from '../data/schema'
import CitedText from './CitedText'

export default function MeaningBlock({ items }: { items: Cited[] }) {
  return (
    <div className="space-y-3">
      {items.map((m, i) => (
        <p key={i}>
          <CitedText cited={m} />
        </p>
      ))}
    </div>
  )
}
