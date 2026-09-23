/**
 * A short statement set one sentence per line, with its last word on the highlighter
 * (the feed tagline, the principle on the About page).
 */
export default function SentenceLines({ text }: { text: string }) {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const last = sentences.pop() ?? ''
  const cut = last.lastIndexOf(' ') + 1
  return (
    <>
      {sentences.map((s) => (
        <span key={s} className="block">
          {s}
        </span>
      ))}
      <span className="block">
        {last.slice(0, cut)}
        <span className="inline-block -rotate-[1.5deg] rounded-lg bg-highlight px-2 pb-0.5 text-ink">
          {last.slice(cut)}
        </span>
      </span>
    </>
  )
}
