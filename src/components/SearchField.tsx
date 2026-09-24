import type { RefObject } from 'react'
import { copy } from '../copy'
import Icon from './Icon'

export const SEARCH_ID = 'feed-search'

/** The feed search box: filters as you type; × clears it and keeps the focus in the box. */
export default function SearchField({
  value,
  onChange,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  return (
    <div role="search" className="relative min-w-0">
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        id={SEARCH_ID}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={copy.search.label}
        placeholder={copy.search.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // phones: "search" on the keyboard closes it so the results show
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-11 w-full rounded-full border border-line-strong bg-surface pr-11 pl-11 text-[16px] text-ink transition-colors placeholder:text-muted hover:border-ink focus:border-ink"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          aria-label={copy.search.clear}
          className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
    </div>
  )
}
