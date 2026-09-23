import { useId, type Ref } from 'react'
import { copy } from '../copy'
import Chip from './Chip'

type ChipRowProps<T extends string> = {
  label: string
  options: readonly T[]
  value: T | null
  onSelect: (value: T | null) => void
}

/** One single-select row. Scrolls sideways on phones, wraps on wider screens. */
function ChipRow<T extends string>({
  label,
  options,
  value,
  onSelect,
}: ChipRowProps<T>) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId}>
      <p id={labelId} className="text-small font-semibold text-muted">
        {label}
      </p>
      <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        <Chip selected={value === null} onClick={() => onSelect(null)}>
          {copy.feed.any}
        </Chip>
        {options.map((option) => (
          <Chip
            key={option}
            selected={value === option}
            onClick={() => onSelect(option)}
          >
            {option}
          </Chip>
        ))}
      </div>
    </div>
  )
}

type Props<Type extends string, Topic extends string> = {
  types: readonly Type[]
  topics: readonly Topic[]
  type: Type | null
  topic: Topic | null
  onTypeChange: (type: Type | null) => void
  onTopicChange: (topic: Topic | null) => void
  ref?: Ref<HTMLElement>
}

export default function FilterBar<Type extends string, Topic extends string>({
  types,
  topics,
  type,
  topic,
  onTypeChange,
  onTopicChange,
  ref,
}: Props<Type, Topic>) {
  const titleId = useId()
  return (
    <section ref={ref} aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="sr-only">
        {copy.feed.filters}
      </h2>
      <ChipRow
        label={copy.feed.type}
        options={types}
        value={type}
        onSelect={onTypeChange}
      />
      <ChipRow
        label={copy.feed.topic}
        options={topics}
        value={topic}
        onSelect={onTopicChange}
      />
    </section>
  )
}
