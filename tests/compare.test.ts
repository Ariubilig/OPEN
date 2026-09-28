import { describe, expect, it } from 'vitest'
import { lineDiff, prettyJson, publicView } from '../src/admin/editor/compare'

describe('publicView', () => {
  it('drops reviewer notes and the draft flag at any depth', () => {
    expect(
      publicView({
        draft: true,
        verify: ['a'],
        meaning: [{ text: 't', source: 's', verify: 'note' }],
      }),
    ).toEqual({ meaning: [{ text: 't', source: 's' }] })
  })
})

describe('prettyJson and lineDiff', () => {
  it('ignores key order and shows only the changed line', () => {
    const before = prettyJson({ title: 'a', id: 'x', topics: ['t'] })
    const after = prettyJson({ id: 'x', topics: ['t'], title: 'b' })
    const blocks = lineDiff(before, after)
    expect(
      blocks.filter((b) => b.kind === 'removed').flatMap((b) => b.lines),
    ).toEqual(['  "title": "a",'])
    expect(
      blocks.filter((b) => b.kind === 'added').flatMap((b) => b.lines),
    ).toEqual(['  "title": "b",'])
    expect(
      lineDiff(
        before,
        prettyJson({ topics: ['t'], id: 'x', title: 'a' }),
      ).every((b) => b.kind === 'same'),
    ).toBe(true)
  })
})
