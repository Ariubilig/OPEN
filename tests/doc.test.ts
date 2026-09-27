import { describe, expect, it } from 'vitest'
import {
  getIn,
  insertIn,
  moveIn,
  removeIn,
  sameDocument,
  setIn,
  stableStringify,
  toJsonPath,
} from '../src/admin/doc'

const doc = {
  title: 'a',
  meaning: [
    { text: 'x', source: 's1' },
    { text: 'y', source: 's2', verify: 'note' },
  ],
}

describe('doc edits', () => {
  it('reads and writes by path without touching the original', () => {
    const next = setIn(doc, ['meaning', 1, 'text'], 'z')
    expect(getIn(next, ['meaning', 1, 'text'])).toBe('z')
    expect(doc.meaning[1].text).toBe('y')
    expect(next.meaning[0]).toBe(doc.meaning[0])
  })

  it('removes a key when set to undefined', () => {
    const next = setIn(doc, ['meaning', 1, 'verify'], undefined)
    expect('verify' in next.meaning[1]).toBe(false)
  })

  it('creates missing objects and lists', () => {
    expect(
      setIn({}, ['numberExplainer', 'paragraphs', 0, 'text'], 't'),
    ).toEqual({ numberExplainer: { paragraphs: [{ text: 't' }] } })
  })

  it('inserts, removes and moves list items', () => {
    const added = insertIn(doc, ['meaning'], { text: 'w', source: 's1' })
    expect(added.meaning.map((m) => m.text)).toEqual(['x', 'y', 'w'])
    expect(removeIn(added, ['meaning'], 0).meaning.map((m) => m.text)).toEqual([
      'y',
      'w',
    ])
    expect(
      moveIn(added, ['meaning'], 2, -1).meaning.map((m) => m.text),
    ).toEqual(['x', 'w', 'y'])
    expect(moveIn(added, ['meaning'], 0, -1)).toBe(added)
  })

  it('writes JSON paths like the validators', () => {
    expect(toJsonPath(['meaning', 2, 'source'])).toBe('$.meaning[2].source')
    expect(toJsonPath([])).toBe('$')
  })
})

describe('stableStringify', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [{ y: 2, x: 1 }], c: undefined })).toBe(
      '{"a":[{"x":1,"y":2}],"b":1}',
    )
    expect(sameDocument({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(sameDocument({ a: [1, 2] }, { a: [2, 1] })).toBe(false)
  })
})
