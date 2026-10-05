// Mongolian messages for validation problems, keyed by JSON path so each field can show its own.
import type { z } from 'zod'
import { jsonPath } from '../data/schema'
import type { Finding } from '../lib/validate'

// the English messages set in src/data/schema.ts
const BY_MESSAGE: Record<string, string> = {
  'must not be empty': 'Хоосон байж болохгүй.',
  'expected a real date as YYYY-MM-DD':
    'Огноог бодит огноогоор, ОООО-СС-ӨӨ хэлбэрээр бичнэ үү.',
  'expected a URL starting with https://':
    'https://-ээр эхэлсэн холбоос бичнэ үү.',
  'expected a lowercase slug like "tax-package-2026"':
    'Жижиг латин үсэг, тоо, зураасаар бичнэ үү. Жишээ нь tax-package-2026.',
  'the last bracket must have "upTo": null':
    'Сүүлийн шатлал дээд хязгааргүй байна.',
}

/** One zod issue in Mongolian. */
export function issueMessage(issue: z.core.$ZodIssue): string {
  if (BY_MESSAGE[issue.message]) return BY_MESSAGE[issue.message]
  switch (issue.code) {
    case 'invalid_union': {
      // e.g. "a URL or TODO_VERIFY": say what the real value should look like
      for (const branch of issue.errors) {
        for (const inner of branch) {
          if (BY_MESSAGE[inner.message]) return BY_MESSAGE[inner.message]
        }
      }
      return 'Утга буруу байна.'
    }
    case 'too_small':
      return issue.origin === 'array'
        ? `Дор хаяж ${issue.minimum} зүйл нэмнэ үү.`
        : issue.origin === 'number'
          ? `${issue.minimum}-аас их утга бичнэ үү.`
          : 'Хоосон байж болохгүй.'
    case 'too_big':
      return issue.origin === 'number'
        ? `${issue.maximum}-аас бага утга бичнэ үү.`
        : 'Хэт урт байна.'
    case 'invalid_value':
      return 'Жагсаалтаас сонгоно уу.'
    case 'invalid_type':
      return issue.input === undefined
        ? 'Бөглөх шаардлагатай.'
        : 'Утгын төрөл буруу байна.'
    case 'unrecognized_keys':
      return `Илүү талбар байна: ${issue.keys.join(', ')}`
    default:
      return 'Утга буруу байна.'
  }
}

/** `$.path → first message` for every issue of a failed parse. */
export function issuesByPath(error: z.ZodError): Map<string, string> {
  const map = new Map<string, string>()
  for (const issue of error.issues) {
    const path = jsonPath(issue.path)
    if (!map.has(path)) map.set(path, issueMessage(issue))
  }
  return map
}

/** Mongolian text for the story rules (codes from src/lib/validate.ts and story_problems()). */
export const RULE_MESSAGES: Record<string, string> = {
  schema: 'Бүтэц буруу байна.',
  duplicate_source: 'Энэ id-тай эх сурвалж давхардсан байна.',
  unknown_source:
    'Ийм id-тай эх сурвалж алга. Эх сурвалжийн жагсаалтаас сонгоно уу.',
  timeline_source_required:
    'Болсон болон одоогийн шатанд эх сурвалж заавал заана.',
  timeline_current_count: 'Шатуудын яг нэг нь «Одоо энд» байна.',
  timeline_order: 'Энэ огноо өмнөх шатынхаас эрт байна.',
  featured_meaning:
    'Онцлох мэдээнд «Энэ юу гэсэн үг вэ?» дор хаяж 2 өгүүлбэр байна.',
  featured_affects:
    'Онцлох мэдээнд «Хэнд хамаатай вэ?» дор хаяж 2 өгүүлбэр байна.',
  featured_evidence: 'Онцлох мэдээнд нотолгооны 4 алхам бүгд байна.',
  featured_participate: 'Онцлох мэдээнд дор хаяж нэг албан ёсны суваг байна.',
  featured_numbers:
    'Онцлох мэдээнд «Юу өөрчлөгдсөн бэ?» эсвэл «Гол тоонууд» байна.',
  unknown_related: 'Ийм id-тай мэдээ алга.',
  unknown_channel: 'Ийм суваг алга.',
  unused_source: 'Энэ эх сурвалжийг аль ч өгүүлбэр заагаагүй байна.',
  duplicate_evidence_step: 'Энэ алхам давхардсан байна.',
  self_related: 'Мэдээ өөрөө өөртэйгөө холбогдсон байна.',
  evaluative_word: 'Үнэлгээний үг байна. Төвийг сахисан үг хэрэглэнэ үү.',
  timeline_overdue:
    'Огноо нь өнгөрсөн ч «Хүлээгдэж буй» хэвээр байна. Болсон эсэхийг эх сурвалжаас шалгаж шинэчилнэ үү.',
  brackets_order: 'Шатлалын дээд хязгаар өмнөхөөсөө их байна.',
  verified_with_todo:
    'Тодорхойгүй хувь үлдсэн байхад «Баталгаажсан» гэж тэмдэглэх боломжгүй.',
}

/** Mongolian text for one finding of src/lib/validate.ts. */
export function findingMessage(f: Finding): string {
  if (f.code === 'schema' && f.issue) return issueMessage(f.issue)
  if (f.code === 'evaluative_word') {
    const word = /"([^"]+)"/.exec(f.message)?.[1]
    return word
      ? `«${word}» гэдэг үнэлгээний үг байна. Төвийг сахисан үг хэрэглэнэ үү.`
      : RULE_MESSAGES.evaluative_word
  }
  return RULE_MESSAGES[f.code] ?? f.message
}

/** `$.path → message` for findings; the first finding of a path wins. */
export function findingsByPath(findings: Finding[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of findings)
    if (!map.has(f.path)) map.set(f.path, findingMessage(f))
  return map
}
