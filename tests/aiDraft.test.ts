import { describe, expect, it } from 'vitest'
import storySchema from '../supabase/functions/_shared/story-schema.json'
import {
  draftCopy,
  draftStory,
  modelSchema,
  readInput,
  SOURCE_ID,
  TODO,
  userPrompt,
  type DraftInput,
} from '../supabase/functions/_shared/aiDraft'
import { validateStory } from '../src/lib/validate'

const schema = storySchema as Record<string, unknown>

const input: DraftInput = {
  storyId: 'sample-draft',
  type: 'Хуулийн төсөл',
  stage: 'Өргөн мэдүүлсэн',
  source: {
    title: 'Жишээ баримт бичиг',
    publisher: 'Жишээ байгууллага',
    url: 'https://example.org/doc',
    publishedAt: '2026-09-01',
    kind: 'official',
  },
  documentText: 'Жишээ текст. '.repeat(40).trim(),
}

// A made-up answer in the shape the model schema asks for.
const cited = (text: string) => ({ text, source: SOURCE_ID })
const output = {
  // the model cannot set these; draftStory ignores them
  id: 'something-else',
  featured: true,
  sources: [],
  topics: ['Татвар'],
  title: 'Жишээ гарчиг',
  officialTitle: cited('Жишээ албан ёсны нэр'),
  summary: cited('Жишээ хураангуй.'),
  timeline: [
    {
      date: '2026-09-01',
      label: 'Өргөн мэдүүлсэн',
      status: 'current',
      source: SOURCE_ID,
    },
    { date: null, label: 'Хэлэлцэх эсэх', status: 'upcoming' },
  ],
  changes: [
    {
      clause: '1.1',
      plainBefore: cited(TODO),
      plainAfter: cited('Жишээ өөрчлөлт.'),
      lawBefore: TODO,
      lawAfter: 'Жишээ заалт.',
      lawSource: SOURCE_ID,
    },
  ],
  meaning: [cited('Жишээ тайлбар.')],
  affects: [{ group: 'Иргэн', text: 'Жишээ нөлөө.', source: SOURCE_ID }],
  evidence: [{ step: 'Бодлого', items: [cited('Жишээ үндэслэл.')] }],
}

function walk(node: unknown, visit: (o: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit))
  else if (node && typeof node === 'object') {
    visit(node as Record<string, unknown>)
    Object.values(node).forEach((n) => walk(n, visit))
  }
}

describe('modelSchema', () => {
  const m = modelSchema(schema)
  const props = m.properties as Record<string, unknown>

  it('leaves out the fields set from the input', () => {
    for (const key of [
      'id',
      'type',
      'stage',
      'featured',
      'sources',
      'publishedAt',
      'verify',
    ])
      expect(props).not.toHaveProperty(key)
    expect(m.required).not.toContain('sources')
    expect(props).toHaveProperty('title')
  })

  it('is in the form structured outputs accepts', () => {
    const text = JSON.stringify(m)
    for (const keyword of ['minLength', 'minItems', 'pattern', '$schema'])
      expect(text).not.toContain(`"${keyword}"`)
    walk(m, (o) => {
      if (o.type === 'object') expect(o.additionalProperties).toBe(false)
    })
  })

  it('lets citations point only at the document or TODO_VERIFY', () => {
    let seen = 0
    walk(m, (o) => {
      const p = o.properties as Record<string, { enum?: string[] }> | undefined
      for (const key of ['source', 'lawSource'])
        if (p?.[key]) {
          seen++
          expect(p[key].enum).toEqual([SOURCE_ID, TODO])
        }
      expect(p ?? {}).not.toHaveProperty('verify')
    })
    expect(seen).toBeGreaterThan(5)
  })

  it('does not change the schema it is given', () => {
    const before = JSON.stringify(schema)
    modelSchema(schema)
    expect(JSON.stringify(schema)).toBe(before)
  })
})

describe('draftStory', () => {
  const story = draftStory(output, input, 'claude-opus-5', '2026-09-28')

  it('is a valid working copy with nothing to fix but the TODOs', () => {
    const report = validateStory(story)
    expect(report.errors).toEqual([])
    expect(report.todos.length).toBeGreaterThan(0)
  })

  it('sets our fields, whatever the model wrote', () => {
    expect(story).toMatchObject({
      id: 'sample-draft',
      type: 'Хуулийн төсөл',
      stage: 'Өргөн мэдүүлсэн',
      featured: false,
      publishedAt: '2026-09-28',
      participate: [],
      sources: [
        {
          id: SOURCE_ID,
          title: 'Жишээ баримт бичиг',
          url: 'https://example.org/doc',
          publishedAt: '2026-09-01',
          accessedAt: '2026-09-28',
          kind: 'official',
        },
      ],
      verify: [draftCopy.storyNote('claude-opus-5')],
    })
  })

  it('marks every cited sentence for checking', () => {
    let cites = 0
    walk(story, (o) => {
      if (typeof o.source === 'string') {
        cites++
        expect(o.verify).toBe(draftCopy.sentenceNote)
      }
    })
    expect(cites).toBe(8)
  })
})

describe('readInput', () => {
  const body = { ...input, source: { ...input.source } }

  it('accepts a complete request', () => {
    expect(readInput(body, schema)).toEqual({ input })
  })

  it('writes TODO_VERIFY for a missing document URL', () => {
    const r = readInput(
      { ...body, source: { ...body.source, url: '' } },
      schema,
    )
    expect(r).toMatchObject({ input: { source: { url: TODO } } })
  })

  it.each([
    [{ storyId: 'Not A Slug' }, 'invalid_id'],
    [{ type: 'Тогтоол' }, 'invalid_input'],
    [{ stage: 'unknown' }, 'invalid_input'],
    [
      { source: { ...input.source, url: 'http://example.org' } },
      'invalid_input',
    ],
    [
      { source: { ...input.source, publishedAt: '2026.09.01' } },
      'invalid_input',
    ],
    [{ source: { ...input.source, title: ' ' } }, 'invalid_input'],
    [{ documentText: 'богино' }, 'document_too_short'],
    [{ documentText: 'x'.repeat(300_001) }, 'document_too_long'],
  ])('rejects %j', (change, error) => {
    expect(readInput({ ...body, ...change }, schema)).toEqual({ error })
  })
})

describe('userPrompt', () => {
  it('gives the details, the editor notes and the document', () => {
    const prompt = userPrompt({ ...input, instructions: '  Товч бич.  ' })
    expect(prompt).toContain('Document type: Хуулийн төсөл')
    expect(prompt).toContain('Published on: 2026-09-01')
    expect(prompt).toContain('The editor adds: Товч бич.')
    expect(prompt).toContain(`<document>\n${input.documentText}\n</document>`)
  })
})
