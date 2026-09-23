/**
 * Browsers may break a line right after a hyphen or a dash. In Mongolian that strands a case
 * suffix or half a range: "792,000₮-|өөс", "УИХ-|ын", "26-|нд", "15–|24". Tokens (runs without
 * spaces) that contain one are kept on one line; they are all short in the story data.
 */
const DASHED_TOKEN = /(\S*[-–]\S*)/u

export type Segment = { text: string; glued: boolean }

/** Split text into plain runs and dashed tokens that should not wrap. */
export function glueSegments(text: string): Segment[] {
  if (!/[-–]/.test(text)) return [{ text, glued: false }]
  return text
    .split(DASHED_TOKEN)
    .map((part, i) => ({ text: part, glued: i % 2 === 1 }))
    .filter((s) => s.text !== '')
}

/** The suffix glued to the start of `text`, e.g. "-өөс" in "-өөс 2,000,000₮ хүртэлх". */
export function leadingSuffix(text: string): string {
  return /^[-–]\S*/u.exec(text)?.[0] ?? ''
}

const NBSP = String.fromCharCode(0xa0)

/**
 * Law texts group digits with spaces ("9 504 000", "120 000 000"). For display, those spaces
 * become no-break spaces so a number is never split across two lines. Nothing else changes.
 */
export function keepNumbersTogether(text: string): string {
  return text.replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
}
