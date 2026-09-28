// Fetching a watched page and reducing it to comparable text. Plain TypeScript (fetch, crypto,
// TextDecoder only), so tests run it with a fake fetch.
//
// The text is what an editor reads in the diff: the page's main content (<main>, else <body>)
// without scripts, styles, navigation and footers, one block per line. Pages that are not text
// (a PDF) are compared by their bytes and have no text.

export const USER_AGENT =
  'TodDocumentWatcher/1.0 (civic news; checks official pages daily)'
export const TIMEOUT_MS = 20_000
export const MAX_BYTES = 5_000_000
/** The same limit as the AI draft's document, so a changed page can go straight to a draft. */
export const MAX_TEXT = 300_000
const MAX_REDIRECTS = 5

/** The database's rule (private.is_watchable_url): public https pages, no IP, port or user info. */
export const WATCHABLE_URL =
  /^https:\/\/[A-Za-z0-9.-]+\.([A-Za-z]{2,}|xn--[A-Za-z0-9-]+)([/?#]\S*)?$/

export type Page = { hash: string; text: string | null }

const NAMED: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  shy: '',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return NAMED[body.toLowerCase()] ?? entity
  })
}

const DROP =
  /<(script|style|noscript|template|svg|iframe|nav|footer|aside)\b[\s\S]*?<\/\1\s*>/gi
const BLOCK =
  /<\/?(p|div|li|ul|ol|tr|table|thead|tbody|section|article|header|h[1-6]|blockquote|pre|dd|dt|dl|form|fieldset|figure|figcaption|main|br|hr)\b[^>]*>/gi

/** The readable text of an HTML page, one block per line, whitespace collapsed. */
export function htmlToText(html: string): string {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(html)
  const body = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(html)
  const part = main?.[1] ?? body?.[1] ?? html
  return normalizeText(
    decodeEntities(
      part
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(DROP, '')
        .replace(BLOCK, '\n')
        .replace(/<\/t[dh]\s*>/gi, ' ')
        .replace(/<[^>]*>/g, ''),
    ),
  )
}

/** Lines trimmed, runs of spaces collapsed, empty lines dropped. */
export function normalizeText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[\s\u00a0\u200b]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

async function readLimited(
  response: Response,
  limit: number,
): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      throw new Error('too_large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? 'utf-8'
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

/**
 * Fetch a page and reduce it to text and a hash. Redirects are followed by hand so each target
 * passes the same URL rule. Throws a short code: http_404, redirect_blocked, too_large, timeout…
 */
export async function fetchPage(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<Page> {
  let target = url
  let response: Response | undefined
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!WATCHABLE_URL.test(target)) throw new Error('redirect_blocked')
    try {
      response = await fetcher(target, {
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5',
          'Accept-Language': 'mn,en;q=0.5',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (e) {
      throw new Error(
        e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'network',
      )
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel()
      target = new URL(location, target).href
      continue
    }
    break
  }
  if (!response || (response.status >= 300 && response.status < 400))
    throw new Error('too_many_redirects')
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`http_${response.status}`)
  }

  const bytes = await readLimited(response, MAX_BYTES)
  const type = response.headers.get('content-type') ?? ''
  let text: string | null = null
  if (/html|xml/i.test(type)) text = htmlToText(decode(bytes, type))
  else if (/^text\/|json/i.test(type)) text = normalizeText(decode(bytes, type))
  // an empty page would look "unchanged" forever: most likely it renders with JavaScript
  if (text === '') throw new Error('no_text')
  if (text !== null) text = text.slice(0, MAX_TEXT)
  return { hash: await sha256Hex(text ?? bytes), text }
}
