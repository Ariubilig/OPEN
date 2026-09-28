// The AI draft, without I/O: what Claude is asked, the JSON Schema its answer must follow, and
// how that answer becomes a working copy. Plain TypeScript (no Deno APIs), so tests can run it.
//
// Guard rails, from CLAUDE.md: the model sees one official document and nothing else; every
// sentence cites it (the schema only allows that source or TODO_VERIFY); unknown values are
// TODO_VERIFY; every generated sentence carries a reviewer note; the story starts as a draft.

export const TODO = 'TODO_VERIFY'
/** The id of the one source a draft is written from. */
export const SOURCE_ID = 'doc'

// Reviewer notes the draft carries (never shown on the site).
export const draftCopy = {
  sentenceNote: 'AI ноорог: баримт бичигтэй тулгаж шалгана уу.',
  storyNote: (model: string) =>
    `AI ноорог (${model}). Өгүүлбэр бүрийг эх баримт бичигтэй тулгаж, дутуу хэсгийг нөхөж, эх сурвалжийн мэдээллийг шалгана уу.`,
}

export type DraftInput = {
  storyId: string
  type: string
  stage: string
  source: {
    title: string
    publisher: string
    url: string
    publishedAt?: string
    kind: 'official' | 'media'
  }
  documentText: string
  instructions?: string
}

type Schema = Record<string, unknown>

// Set from the input, never by the model.
const SET_BY_US = [
  'id',
  'draft',
  'type',
  'stage',
  'featured',
  'order',
  'publishedAt',
  'updatedAt',
  'reviewed',
  'calculator',
  'participate',
  'relatedStoryIds',
  'sources',
  'corrections',
  'verify',
]
// JSON Schema keywords structured outputs does not take (the editor checks these later).
const UNSUPPORTED = [
  '$schema',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'pattern',
  'minimum',
  'maximum',
]

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean)
  if (!node || typeof node !== 'object') return node
  const out: Schema = {}
  for (const [key, value] of Object.entries(node as Schema)) {
    if (UNSUPPORTED.includes(key)) continue
    out[key] = clean(value)
  }
  const properties = out.properties as Record<string, Schema> | undefined
  if (properties) {
    // reviewer notes are ours to add
    delete properties.verify
    // a citation can only point at the document, or say it is not known yet
    for (const key of ['source', 'lawSource']) {
      if (properties[key])
        properties[key] = { type: 'string', enum: [SOURCE_ID, TODO] }
    }
    if (Array.isArray(out.required))
      out.required = (out.required as string[]).filter((k) => k in properties)
  }
  return out
}

/** The story schema reduced to what the model writes, in the form structured outputs accepts. */
export function modelSchema(storySchema: Schema): Schema {
  const schema = clean(storySchema) as Schema
  const properties = schema.properties as Record<string, unknown>
  for (const key of SET_BY_US) delete properties[key]
  schema.required = (schema.required as string[]).filter((k) => k in properties)
  return schema
}

export const SYSTEM_PROMPT = `You draft plain-language explainers for a Mongolian civic news site. You receive one official document of the State Great Khural or the Government (a law, bill, resolution, regulation, budget or government decision) and write a draft story about it, in Mongolian Cyrillic, as JSON that follows the given schema. A human editor checks every sentence against the document before a second person publishes it, so write for that check: plain, specific, traceable.

How to write it:
- Use only the document you are given. Every sentence must be supported by it. Do not add facts, numbers, dates, names, places, URLs or legal wording that are not in the document, and do not rely on what you may know about the topic from elsewhere.
- Every sentence object cites its source: "source": "${SOURCE_ID}". If the document does not support a statement well enough to cite it, leave the statement out.
- When a value the schema asks for is not in the document (a date, an amount, a clause number, the previous wording of a law), write exactly ${TODO}. Never estimate or guess. Timeline steps that have no date in the document get "date": null and a short "dateText" only if the document gives one.
- Neutral wording: no evaluative words (good, bad, historic, successful, failed and the like), no party framing, no predictions of effects the document does not state. Where the document states someone's position or estimate, attribute it ("Засгийн газрын тооцоогоор …").
- Plain Mongolian: short sentences, everyday words, legal terms explained. The title says what changes for people, in about 90 characters or fewer, without sensational phrasing. The summary is one or two sentences.
- "changes": one entry per changed clause the document shows. "lawAfter" is copied exactly from the document; "lawBefore" is copied exactly when the document contains the previous wording, "" for a clause that is new, and ${TODO} when the previous wording is not in the document.
- "affects": only groups the document gives a basis for, each with what changes for that group.
- "timeline": the document's own steps in date order, exactly one with status "current" (where the document is now), earlier steps "done", later ones "upcoming".
- "evidence": only steps the document gives a basis for (policy basis, budget, impact assessment, public consultation); leave the rest out.
- Numbers: amounts as the document writes them, with thousands separators and ₮ for exact amounts (12,080₮); large sums in words (43.6 их наяд төгрөг); dates as YYYY-MM-DD.
- Leave out any section the document gives no basis for (an empty list, or leave the optional field out).`

/** The user turn: the editor's details, then the document itself. */
export function userPrompt(input: DraftInput): string {
  const meta = [
    `Document type: ${input.type}`,
    `Stage: ${input.stage}`,
    `Title: ${input.source.title}`,
    `Published by: ${input.source.publisher}`,
    ...(input.source.publishedAt
      ? [`Published on: ${input.source.publishedAt}`]
      : []),
  ].join('\n')
  const notes = input.instructions?.trim()
    ? `\n\nThe editor adds: ${input.instructions.trim()}`
    : ''
  return `Write the draft story for this document.\n\n${meta}${notes}\n\n<document>\n${input.documentText}\n</document>`
}

/** Add the reviewer note to every object that cites a source (sentences, numbers, steps…). */
function noteEverySentence(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(noteEverySentence)
  if (!node || typeof node !== 'object') return node
  const out: Schema = {}
  for (const [key, value] of Object.entries(node as Schema))
    out[key] = noteEverySentence(value)
  if (typeof out.source === 'string' && out.verify === undefined)
    out.verify = draftCopy.sentenceNote
  return out
}

/** The model's answer as a working copy: our fields set, its sentences marked for checking. */
export function draftStory(
  output: Record<string, unknown>,
  input: DraftInput,
  model: string,
  today: string,
): Record<string, unknown> {
  const written = noteEverySentence(output) as Record<string, unknown>
  for (const key of SET_BY_US) delete written[key]
  return {
    id: input.storyId,
    type: input.type,
    stage: input.stage,
    featured: false,
    ...written,
    publishedAt: today,
    participate: [],
    sources: [
      {
        id: SOURCE_ID,
        title: input.source.title,
        publisher: input.source.publisher,
        url: input.source.url,
        ...(input.source.publishedAt
          ? { publishedAt: input.source.publishedAt }
          : {}),
        accessedAt: today,
        kind: input.source.kind,
      },
    ],
    verify: [draftCopy.storyNote(model)],
  }
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The request body checked against the schema's own lists; the reason when it is not usable. */
export function readInput(
  body: unknown,
  storySchema: Schema,
): { input: DraftInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const source = (b.source ?? {}) as Record<string, unknown>
  const props = storySchema.properties as Record<string, { enum?: string[] }>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const input: DraftInput = {
    storyId: str(b.storyId),
    type: str(b.type),
    stage: str(b.stage),
    source: {
      title: str(source.title),
      publisher: str(source.publisher),
      url: str(source.url) || TODO,
      publishedAt: str(source.publishedAt) || undefined,
      kind: source.kind === 'media' ? 'media' : 'official',
    },
    documentText:
      typeof b.documentText === 'string' ? b.documentText.trim() : '',
    instructions: str(b.instructions) || undefined,
  }
  if (!SLUG.test(input.storyId) || input.storyId.length > 80)
    return { error: 'invalid_id' }
  if (
    !props.type.enum?.includes(input.type) ||
    !props.stage.enum?.includes(input.stage)
  )
    return { error: 'invalid_input' }
  if (!input.source.title || !input.source.publisher)
    return { error: 'invalid_input' }
  if (input.source.url !== TODO && !/^https:\/\/\S+$/.test(input.source.url))
    return { error: 'invalid_input' }
  if (input.source.publishedAt && !DATE.test(input.source.publishedAt))
    return { error: 'invalid_input' }
  if (input.documentText.length < 200) return { error: 'document_too_short' }
  if (input.documentText.length > 300_000) return { error: 'document_too_long' }
  if ((input.instructions?.length ?? 0) > 2000)
    return { error: 'invalid_input' }
  return { input }
}
