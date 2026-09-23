import { describe, expect, it } from 'vitest'
import { channels, getChannel, getStory, stories, taxRules } from '../src/data'
import { CHANNEL_IDS } from '../src/data/schema'

// Every story file, templates included, read raw (no validation, no filtering).
const rawFiles = Object.entries(
  import.meta.glob<{ id: string; draft?: boolean }>(
    '../src/data/stories/*.json',
    { eager: true, import: 'default' },
  ),
).map(([path, json]) => ({ file: path.split('/').pop()!, json }))

describe('data', () => {
  it('loads every story through src/data/index.ts without zod errors', () => {
    const expected = rawFiles.filter(
      (f) => !f.file.startsWith('_') && f.json.draft !== true,
    )
    expect(stories.length).toBe(expected.length)
    expect(stories.length).toBeGreaterThan(0)
  })

  it('has unique story ids', () => {
    const ids = stories.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getStory returns each story and undefined for an unknown id', () => {
    for (const s of stories) expect(getStory(s.id)).toBe(s)
    expect(getStory('no-such-story')).toBeUndefined()
  })

  it('never loads templates or drafts', () => {
    const hidden = rawFiles.filter(
      (f) => f.file.startsWith('_') || f.json.draft === true,
    )
    expect(hidden.length).toBeGreaterThan(0) // _template.json exists
    for (const f of hidden) {
      expect(stories.find((s) => s.id === f.json.id)).toBeUndefined()
    }
    expect(stories.every((s) => s.draft !== true)).toBe(true)
  })

  it('covers at least 5 document types', () => {
    expect(new Set(stories.map((s) => s.type)).size).toBeGreaterThanOrEqual(5)
  })

  it('sorts by order, then newest first', () => {
    const orders = stories.map((s) => s.order ?? Infinity)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('has every channel', () => {
    expect(channels.map((c) => c.id).sort()).toEqual([...CHANNEL_IDS].sort())
    for (const id of CHANNEL_IDS) expect(getChannel(id)?.id).toBe(id)
  })

  it('has tax rules for 2026–2028', () => {
    expect(taxRules.years.map((y) => y.year)).toEqual([2026, 2027, 2028])
  })
})
