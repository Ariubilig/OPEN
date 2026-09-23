import { copy } from '../copy'

/** Visible stand-in for a TODO_VERIFY value — the raw token is never shown. */
export default function Placeholder() {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-placeholder-line bg-placeholder-bg px-1.5 align-baseline text-small leading-normal font-semibold text-placeholder-ink">
      {copy.placeholder}
    </span>
  )
}
