// Story documents in the editor: new items, renaming a source, and the document as it will be
// published (what validation and the preview look at).
import {
  isIsoDate,
  TODO,
  type DocType,
  type Group,
  type Stage,
} from '../../data/schema'
import { setIn } from '../doc'

export const AFFECT_DEFAULT_GROUP: Group = 'Иргэн'

/** A new cited sentence: the source is left for the editor to choose (never guessed). */
export const newCited = () => ({ text: '', source: '' })

export const newSource = (n: number) => ({
  id: `src-${n}`,
  title: '',
  publisher: '',
  url: TODO,
  accessedAt: TODO,
  kind: 'official',
})

/** A new story with only what the editor typed; everything else is left to fill in. */
export function newStory(fields: {
  id: string
  type: DocType
  stage: Stage
  title: string
  today: string
}) {
  return {
    id: fields.id,
    type: fields.type,
    stage: fields.stage,
    topics: [],
    featured: false,
    title: fields.title,
    officialTitle: { text: TODO, source: TODO },
    summary: { text: TODO, source: TODO },
    publishedAt: fields.today,
    timeline: [],
    meaning: [],
    affects: [],
    evidence: [],
    participate: [],
    sources: [],
  }
}

const REFERENCE_KEYS = new Set(['source', 'lawSource'])

function replaceReferences(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value))
    return value.map((v) => replaceReferences(v, from, to))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        REFERENCE_KEYS.has(k) && v === from
          ? to
          : replaceReferences(v, from, to),
      ]),
    )
  }
  return value
}

/** Rename source `index` from `from` to `to`, and every reference to it. */
export function renameSource(
  doc: unknown,
  index: number,
  from: string,
  to: string,
): unknown {
  const doc2 = setIn(doc, ['sources', index, 'id'], to)
  if (!doc2 || typeof doc2 !== 'object') return doc2
  const { sources, ...rest } = doc2 as Record<string, unknown>
  return { ...(replaceReferences(rest, from, to) as object), sources }
}

/**
 * The document as it will be published: publish_story() sets publishedAt on the first publish,
 * so a draft without one is checked (and previewed) with today's date.
 */
export function asPublished(doc: unknown, today: string): unknown {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc
  const publishedAt = (doc as { publishedAt?: unknown }).publishedAt
  return typeof publishedAt === 'string' && isIsoDate(publishedAt)
    ? doc
    : { ...doc, publishedAt: today }
}

/** Save a document as a pretty-printed JSON file in the browser. */
export function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
