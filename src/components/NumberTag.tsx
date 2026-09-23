/** "01", "02" … — the numbered tag in front of a section heading (story and About pages). */
export default function NumberTag({
  n,
  dark = false,
}: {
  n: number
  dark?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-6 w-[30px] shrink-0 items-center justify-center rounded-[7px] text-overline font-extrabold tabular-nums ${
        dark ? 'bg-highlight text-ink' : 'bg-ink text-highlight'
      }`}
    >
      {String(n).padStart(2, '0')}
    </span>
  )
}
