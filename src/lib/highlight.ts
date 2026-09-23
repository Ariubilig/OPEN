/**
 * Amounts worth a highlighter stroke, as they are written in the story data:
 * 792,000₮ · 792,000–2,000,000₮ · 43.6 их наяд (төгрөг) · 840 тэрбум төгрөг · 1%.
 * "төгрөг" joins only as a whole word: in "2.306 их наяд төгрөгийн" the stroke stops at "наяд".
 */
const AMOUNT =
  /\d[\d,]*(?:\.\d+)?(?:–\d[\d,]*(?:\.\d+)?)?₮|\d+(?:\.\d+)?\s(?:их наяд|тэрбум|сая)(?:\sтөгрөг(?!\p{L}))?|\d+(?:\.\d+)?%/u

/** Split `text` around its first amount: [before, amount, after], or null when there is none. */
export function splitFirstAmount(
  text: string,
): [string, string, string] | null {
  const m = AMOUNT.exec(text)
  if (!m) return null
  return [text.slice(0, m.index), m[0], text.slice(m.index + m[0].length)]
}

/**
 * A key-number value split into its number and unit, so the number can be set big:
 * '45.7 их наяд төгрөг' → ['45.7', 'их наяд төгрөг'] · '12,080₮' → ['12,080₮', ''] ·
 * 'Нийслэлийн төсөв' → null (text, not a number).
 */
export function splitNumberUnit(value: string): [string, string] | null {
  const m = /^([−-]?\d[\d,.]*[%₮]?)(?:\s+(\S.*))?$/u.exec(value.trim())
  return m ? [m[1], m[2] ?? ''] : null
}
