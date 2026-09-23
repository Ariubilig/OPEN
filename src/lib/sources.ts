import { TODO, type Story } from '../data/schema'

export type SourceRef = {
  /** JSON path of the `source` field, e.g. `$.meaning[2].source` */
  path: string
  /** Source id, or 'TODO_VERIFY' */
  source: string
  /** Whether the page renders a marker for this reference (no marker for TODO text or TODO source). */
  marked: boolean
}

/**
 * Every source reference in a story, in the order the story page renders them:
 * official title → summary → changes (plainBefore, plainAfter, lawSource) → key numbers →
 * explainer → meaning → positions → affects → timeline → evidence.
 */
export function sourceRefs(story: Story): SourceRef[] {
  const refs: SourceRef[] = []
  const add = (path: string, source: string, text: string) =>
    refs.push({ path, source, marked: text !== TODO && source !== TODO })

  add(
    '$.officialTitle.source',
    story.officialTitle.source,
    story.officialTitle.text,
  )
  add('$.summary.source', story.summary.source, story.summary.text)
  story.changes?.forEach((c, i) => {
    add(
      `$.changes[${i}].plainBefore.source`,
      c.plainBefore.source,
      c.plainBefore.text,
    )
    add(
      `$.changes[${i}].plainAfter.source`,
      c.plainAfter.source,
      c.plainAfter.text,
    )
    // The law-text panel always shows where the exact wording comes from, even before it is filled in.
    add(`$.changes[${i}].lawSource`, c.lawSource, '')
  })
  story.keyNumbers?.forEach((k, i) =>
    add(`$.keyNumbers[${i}].source`, k.source, k.value),
  )
  story.numberExplainer?.paragraphs.forEach((p, i) =>
    add(`$.numberExplainer.paragraphs[${i}].source`, p.source, p.text),
  )
  story.meaning.forEach((m, i) =>
    add(`$.meaning[${i}].source`, m.source, m.text),
  )
  story.positions?.forEach((p, i) =>
    add(`$.positions[${i}].source`, p.source, p.text),
  )
  story.affects.forEach((a, i) =>
    add(`$.affects[${i}].source`, a.source, a.text),
  )
  story.timeline.forEach((t, i) => {
    if (t.source) add(`$.timeline[${i}].source`, t.source, t.label)
  })
  story.evidence.forEach((e, i) =>
    e.items.forEach((item, j) =>
      add(`$.evidence[${i}].items[${j}].source`, item.source, item.text),
    ),
  )
  return refs
}

/**
 * Marker numbers: sources are numbered in order of their first rendered reference;
 * sources that are never referenced get the next numbers in list order.
 */
export function numberSources(story: Story): Map<string, number> {
  const known = new Set(story.sources.map((s) => s.id))
  const numbers = new Map<string, number>()
  for (const ref of sourceRefs(story)) {
    if (ref.marked && known.has(ref.source) && !numbers.has(ref.source)) {
      numbers.set(ref.source, numbers.size + 1)
    }
  }
  for (const s of story.sources) {
    if (!numbers.has(s.id)) numbers.set(s.id, numbers.size + 1)
  }
  return numbers
}
