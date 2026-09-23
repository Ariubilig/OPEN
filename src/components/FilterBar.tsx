import { copy } from '../copy'
import Chip from './Chip'
import Icon from './Icon'

/**
 * Document type filter: a native <select> laid invisibly over a pill that shows the current
 * choice ("Төрөл: Бүгд"), so the pill can be as wide as its text and still open the native picker.
 */
export function TypeSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  return (
    <div className="relative inline-flex h-11 max-w-[190px] shrink-0 items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-3 pl-4 text-small font-semibold text-ink transition-colors hover:border-ink has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent md:max-w-[300px]">
      <span aria-hidden="true" className="truncate">
        {copy.feed.type}: {value ?? copy.feed.any}
      </span>
      <Icon name="chevronDown" className="size-[18px]" />
      <select
        aria-label={copy.feed.type}
        value={value ?? ''}
        onChange={(e) =>
          onChange(options.find((o) => o === e.target.value) ?? null)
        }
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="">{copy.feed.any}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Single-select topic chips: one row that scrolls sideways on phones, wraps on wider screens. */
export function TopicChips<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly T[]
  value: T | null
  onSelect: (value: T | null) => void
}) {
  return (
    <div
      role="group"
      aria-label={copy.feed.topic}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
    >
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
  )
}
