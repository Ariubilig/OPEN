import { TODO, type Story } from '../data/schema'

/** Lower case, one space between words, and no thousands separators: "792,000₮" → "792000₮". */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('mn')
    .replace(/(\d)[,\s](?=\d{3}\b)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

const haystacks = new WeakMap<Story, string>()

/** Everything a reader might search for in a story, normalized once. */
function haystack(story: Story): string {
  const cached = haystacks.get(story)
  if (cached !== undefined) return cached
  const parts = [
    story.title,
    story.officialTitle.text,
    story.summary.text,
    story.type,
    story.stage,
    ...story.topics,
    ...(story.keyNumbers ?? []).flatMap((k) => [
      k.label,
      k.value,
      k.note ?? '',
    ]),
    ...(story.changes ?? []).flatMap((c) => [
      c.clause,
      c.plainBefore.text,
      c.plainAfter.text,
    ]),
    ...story.meaning.map((m) => m.text),
    ...(story.positions ?? []).flatMap((p) => [p.actor, p.text]),
    ...story.affects.flatMap((a) => [a.group, a.text]),
    ...story.timeline.map((t) => t.label),
  ]
  const text = normalize(parts.join(' ').replaceAll(TODO, ' '))
  haystacks.set(story, text)
  return text
}

/** True when every word of the query appears in the story. An empty query matches everything. */
export function matchesQuery(story: Story, query: string): boolean {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const text = haystack(story)
  return terms.every((term) => text.includes(term))
}
