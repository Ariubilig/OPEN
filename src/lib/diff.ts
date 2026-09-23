import { diffWords } from 'diff'

export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string }

// jsdiff's default word pattern splits Mongolian words at ө/ү; Intl.Segmenter keeps them whole.
const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('mn', { granularity: 'word' })
    : undefined

/** Word-level diff of two law texts. */
export function lawDiff(before: string, after: string): DiffPart[] {
  const changes = segmenter
    ? diffWords(before, after, { intlSegmenter: segmenter })
    : diffWords(before, after)
  return changes.map((c) => ({
    kind: c.added ? 'added' : c.removed ? 'removed' : 'same',
    text: c.value,
  }))
}
