// Data contract (brief §5). Framework-free: zod only — also imported by scripts/check.ts under tsx.
import { z } from 'zod'

export const TODO = 'TODO_VERIFY'

export const DOC_TYPES = [
  'Хууль',
  'Хуулийн төсөл',
  'УИХ-ын тогтоол',
  'Олон улсын гэрээ',
  'Засгийн газрын тогтоол',
  'Журам',
  'Хөрөнгө оруулалтын төсөл',
  'Засгийн газрын мэдэгдэл',
] as const

export const STAGES = [
  // bills in parliament — 'Хэлэлцэх эсэх', 'Анхны хэлэлцүүлэг', 'Эцсийн хэлэлцүүлэг' are the names in
  // Art. 34.1 of Улсын Их Хурлын чуулганы хуралдааны дэгийн тухай хууль (legalinfo.mn/mn/detail?lawId=15412)
  'Санал авч байна',
  'Өргөн мэдүүлсэн',
  'Хэлэлцэх эсэх',
  'Анхны хэлэлцүүлэг',
  'Эцсийн хэлэлцүүлэг',
  'Батлагдсан',
  'Ерөнхийлөгчийн хориг',
  'Нийтлэгдсэн',
  'Мөрдөж эхэлсэн',
  // drafts on legalinfo.mn (use its status names exactly)
  'Идэвхтэй',
  'Санал авч дууссан',
  'Дүгнэлт гаргасан',
  'Баталсан',
  'Цуцалсан',
  // announcements and projects
  'Танилцуулсан',
  'Хэрэгжиж байна',
] as const

export const TOPICS = [
  'Татвар',
  'Төсөв ба санхүү',
  'Орон сууц',
  'Боловсрол',
  'Эрүүл мэнд',
  'Ажил ба нийгмийн даатгал',
  'Эрчим хүч',
  'Байгаль орчин',
  'Хот ба дэд бүтэц',
  'Засаглал',
] as const

export const GROUPS = [
  'Оюутан',
  'Ажилтан',
  'Бизнес эрхлэгч',
  'Иргэн',
  'Эцэг эх',
  'Тэтгэвэр авагч',
  'Ахмад настан',
  'Төрийн албан хаагч',
  'Төрийн байгууллага',
] as const

export const EVIDENCE_STEPS = [
  'Бодлого',
  'Төсөв',
  'Үр нөлөөний үнэлгээ',
  'Олон нийтийн санал',
] as const

export const CHANNEL_IDS = [
  'd-parliament',
  'legalinfo-bills',
  'legalinfo-regulations',
  'e-mongolia',
  'petition',
] as const

export type DocType = (typeof DOC_TYPES)[number]
export type Stage = (typeof STAGES)[number]
export type Topic = (typeof TOPICS)[number]
export type Group = (typeof GROUPS)[number]
export type EvidenceStepName = (typeof EVIDENCE_STEPS)[number]
export type ChannelId = (typeof CHANNEL_IDS)[number]

// ---- primitives -----------------------------------------------------------

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  )
}

const Todo = z.literal(TODO)
const IsoDate = z
  .string()
  .refine(isIsoDate, { message: 'expected a real date as YYYY-MM-DD' })
const IsoDateOrTodo = z.union([Todo, IsoDate])
const Text = z.string().trim().min(1, { message: 'must not be empty' })
const HttpsUrl = z
  .string()
  .regex(/^https:\/\/\S+$/, { message: 'expected a URL starting with https://' })
const UrlOrTodo = z.union([Todo, HttpsUrl])

// ---- story parts ----------------------------------------------------------

export const CitedSchema = z.strictObject({
  text: Text, // our plain-language sentence, or 'TODO_VERIFY'
  source: Text, // an id from story.sources, or 'TODO_VERIFY'
  verify: Text.optional(), // reviewer note — never rendered
})

export const SourceSchema = z.strictObject({
  id: Text,
  title: Text,
  publisher: Text,
  url: UrlOrTodo,
  publishedAt: IsoDateOrTodo.optional(),
  accessedAt: IsoDateOrTodo,
  kind: z.enum(['official', 'media']),
  note: Text.optional(),
})

export const TimelineItemSchema = z.strictObject({
  date: z.union([IsoDateOrTodo, z.null()]), // null = not scheduled
  dateText: Text.optional(), // shown when date is null
  label: Text,
  status: z.enum(['done', 'current', 'upcoming']),
  note: Text.optional(),
  source: Text.optional(), // required for 'done' and 'current' (scripts/check.ts)
  verify: Text.optional(),
})

export const ChangeSchema = z.strictObject({
  clause: Text,
  plainBefore: CitedSchema,
  plainAfter: CitedSchema,
  lawBefore: Text, // exact law text, or 'TODO_VERIFY'
  lawAfter: Text,
  lawSource: Text,
  effectiveFrom: IsoDate.optional(),
})

export const KeyNumberSchema = z.strictObject({
  label: Text,
  value: Text,
  note: Text.optional(),
  source: Text,
  verify: Text.optional(),
})

export const PositionSchema = z.strictObject({
  actor: Text,
  text: Text,
  source: Text,
  verify: Text.optional(),
})

export const AffectSchema = z.strictObject({
  group: z.enum(GROUPS),
  text: Text,
  source: Text,
  verify: Text.optional(),
})

export const EvidenceStepSchema = z.strictObject({
  step: z.enum(EVIDENCE_STEPS),
  items: z.array(CitedSchema), // empty → "Одоогоор олдсонгүй"
})

export const ParticipateRefSchema = z.strictObject({
  channel: z.enum(CHANNEL_IDS),
  label: Text,
  url: HttpsUrl.optional(), // overrides channel.url
  note: Text.optional(),
})

export const StorySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'expected a lowercase slug like "tax-package-2026"',
  }),
  draft: z.boolean().optional(), // true = hidden from the site and skipped by strict checks
  type: z.enum(DOC_TYPES),
  stage: z.enum(STAGES),
  topics: z.array(z.enum(TOPICS)).min(1),
  featured: z.boolean(), // full explainer vs. card-level story
  order: z.number().optional(),
  title: Text,
  officialTitle: CitedSchema,
  summary: CitedSchema,
  publishedAt: IsoDate,
  updatedAt: IsoDate.optional(),
  reviewed: z.strictObject({ by: Text, date: IsoDateOrTodo }).optional(),
  timeline: z.array(TimelineItemSchema),
  changes: z.array(ChangeSchema).optional(),
  keyNumbers: z.array(KeyNumberSchema).optional(),
  numberExplainer: z
    .strictObject({ question: Text, paragraphs: z.array(CitedSchema).min(1) })
    .optional(),
  meaning: z.array(CitedSchema),
  positions: z.array(PositionSchema).optional(),
  affects: z.array(AffectSchema),
  evidence: z.array(EvidenceStepSchema),
  calculator: z.literal('pit').optional(),
  participate: z.array(ParticipateRefSchema),
  relatedStoryIds: z.array(Text).optional(),
  sources: z.array(SourceSchema).min(1),
  corrections: z.array(z.strictObject({ date: IsoDate, text: Text })).optional(),
  verify: z.array(Text).optional(), // team notes — never rendered
})

// ---- channels and tax rules -----------------------------------------------

export const RefSchema = z.strictObject({
  title: Text,
  publisher: Text,
  url: UrlOrTodo,
  publishedAt: IsoDate.optional(),
})

export const ChannelSchema = z.strictObject({
  id: z.enum(CHANNEL_IDS),
  name: Text,
  url: z.union([HttpsUrl, z.null()]), // null = no link yet: description only, no button
  description: Text,
  source: RefSchema,
  verify: Text.optional(),
})

export const ChannelsSchema = z.array(ChannelSchema)

export const BracketSchema = z.strictObject({
  upTo: z.union([z.number().positive(), z.null()]),
  rate: z.union([z.number().min(0).max(1), Todo]),
})

export const TaxRulesSchema = z.strictObject({
  verified: z.boolean(),
  assumption: Text,
  source: RefSchema,
  lawSource: RefSchema,
  years: z
    .array(
      z.strictObject({
        year: z.number().int(),
        label: Text,
        brackets: z
          .array(BracketSchema)
          .min(1)
          .refine((bs) => bs[bs.length - 1].upTo === null, {
            message: 'the last bracket must have "upTo": null',
          }),
        verify: Text.optional(),
      }),
    )
    .min(1),
})

// ---- inferred types (same names as the contract in the brief) ------------

export type IsoDate = string // 'YYYY-MM-DD'
export type Cited = z.infer<typeof CitedSchema>
export type Source = z.infer<typeof SourceSchema>
export type TimelineItem = z.infer<typeof TimelineItemSchema>
export type Change = z.infer<typeof ChangeSchema>
export type KeyNumber = z.infer<typeof KeyNumberSchema>
export type Position = z.infer<typeof PositionSchema>
export type Affect = z.infer<typeof AffectSchema>
export type EvidenceStep = z.infer<typeof EvidenceStepSchema>
export type ParticipateRef = z.infer<typeof ParticipateRefSchema>
export type Story = z.infer<typeof StorySchema>
export type Ref = z.infer<typeof RefSchema>
export type Channel = z.infer<typeof ChannelSchema>
export type Bracket = z.infer<typeof BracketSchema>
export type TaxRules = z.infer<typeof TaxRulesSchema>

// ---- helpers ---------------------------------------------------------------

/** `['timeline', 2, 'date']` → `$.timeline[2].date` */
export function jsonPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, key) =>
      typeof key === 'number' ? `${acc}[${key}]` : `${acc}.${String(key)}`,
    '$',
  )
}

/** One readable line per zod issue: `$.timeline[2].date — expected a real date as YYYY-MM-DD` */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${jsonPath(i.path)} — ${i.message}`)
}
