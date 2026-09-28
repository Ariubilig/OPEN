import { describe, expect, it } from 'vitest'
import {
  fetchPage,
  htmlToText,
  MAX_BYTES,
  normalizeText,
  sha256Hex,
  WATCHABLE_URL,
} from '../supabase/functions/_shared/watch'

const page = (body: string) =>
  `<!doctype html><html lang="mn"><head><title>Гарчиг</title><script>var t = Date.now()</script></head><body>${body}</body></html>`

describe('htmlToText', () => {
  it('keeps the readable text, one block per line', () => {
    const html = page(
      '<h1>Хуулийн  төсөл</h1><p>Нэгдүгээр&nbsp;зүйл.<br>Хоёр&amp;гурав</p><ul><li>Нэг</li><li>Хоёр</li></ul><table><tr><td>А</td><td>Б</td></tr></table>',
    )
    expect(htmlToText(html)).toBe(
      'Хуулийн төсөл\nНэгдүгээр зүйл.\nХоёр&гурав\nНэг\nХоёр\nА Б',
    )
  })

  it('drops scripts, styles, navigation, footers and comments', () => {
    const html = page(
      '<nav><a href="/">Нүүр</a></nav><style>p{color:red}</style><!-- 2026-09-28 12:00 --><p>Агуулга</p><script>track()</script><footer>© 2026</footer>',
    )
    expect(htmlToText(html)).toBe('Агуулга')
  })

  it('reads only <main> when the page has one', () => {
    expect(
      htmlToText(
        page(
          '<header>Сайт</header><main><p>Эх бичвэр</p></main><div>Өөр</div>',
        ),
      ),
    ).toBe('Эх бичвэр')
  })

  it('decodes numeric entities and leaves unknown ones', () => {
    expect(
      htmlToText('<p>&#1052;&#x43e;&#1085; &laquo;x&raquo; &unknown;</p>'),
    ).toBe('Мон «x» &unknown;')
  })
})

describe('normalizeText', () => {
  it('ignores spacing differences', () => {
    expect(normalizeText('  a \t b \r\n\n\u00a0c  ')).toBe('a b\nc')
  })
})

describe('WATCHABLE_URL', () => {
  // the same cases as private.is_watchable_url in supabase/tests/database/watch.test.sql
  it.each([
    ['https://legalinfo.mn/mn/detail?lawId=1', true],
    ['https://d.parliament.mn', true],
    ['https://xn--h1aax.xn--l1acc/x', true],
    ['http://legalinfo.mn/', false],
    ['https://127.0.0.1/', false],
    ['https://localhost/', false],
    ['https://legalinfo.mn:8443/', false],
    ['https://user@legalinfo.mn/', false],
  ])('%s → %s', (url, ok) => {
    expect(WATCHABLE_URL.test(url)).toBe(ok)
  })
})

type Reply = {
  status?: number
  type?: string
  body?: string | Uint8Array
  location?: string
}

/** A fetch that answers from a table of URLs and records what was asked. */
function fakeFetch(replies: Record<string, Reply>) {
  const asked: string[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    asked.push(url)
    expect(init?.redirect).toBe('manual')
    const reply = replies[url]
    if (!reply) throw new TypeError('network')
    const headers = new Headers()
    if (reply.type) headers.set('content-type', reply.type)
    if (reply.location) headers.set('location', reply.location)
    return new Response((reply.body ?? '') as BodyInit, {
      status: reply.status ?? 200,
      headers,
    })
  }) as typeof fetch
  return { fetcher, asked }
}

describe('fetchPage', () => {
  it('returns the text of an HTML page and its hash', async () => {
    const { fetcher } = fakeFetch({
      'https://legalinfo.mn/a': {
        type: 'text/html; charset=utf-8',
        body: page('<p>Эх бичвэр</p>'),
      },
    })
    const result = await fetchPage('https://legalinfo.mn/a', fetcher)
    expect(result).toEqual({
      text: 'Эх бичвэр',
      hash: await sha256Hex('Эх бичвэр'),
    })
  })

  it('follows redirects that pass the rule', async () => {
    const { fetcher, asked } = fakeFetch({
      'https://legalinfo.mn/a': { status: 301, location: '/b' },
      'https://legalinfo.mn/b': { type: 'text/plain', body: 'Шинэ' },
    })
    expect((await fetchPage('https://legalinfo.mn/a', fetcher)).text).toBe(
      'Шинэ',
    )
    expect(asked).toEqual(['https://legalinfo.mn/a', 'https://legalinfo.mn/b'])
  })

  it('refuses a redirect to a private address', async () => {
    const { fetcher, asked } = fakeFetch({
      'https://legalinfo.mn/a': {
        status: 302,
        location: 'https://127.0.0.1/admin',
      },
    })
    await expect(fetchPage('https://legalinfo.mn/a', fetcher)).rejects.toThrow(
      'redirect_blocked',
    )
    expect(asked).toEqual(['https://legalinfo.mn/a'])
  })

  it('compares a PDF by its bytes, without text', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3])
    const { fetcher } = fakeFetch({
      'https://legalinfo.mn/a.pdf': { type: 'application/pdf', body: bytes },
    })
    expect(await fetchPage('https://legalinfo.mn/a.pdf', fetcher)).toEqual({
      text: null,
      hash: await sha256Hex(bytes),
    })
  })

  it.each([
    [{ status: 404 }, 'http_404'],
    [{ type: 'text/html', body: page('<div id="root"></div>') }, 'no_text'],
    [{ type: 'text/plain', body: new Uint8Array(MAX_BYTES + 1) }, 'too_large'],
  ])('fails with a short code (%#)', async (reply, code) => {
    const { fetcher } = fakeFetch({ 'https://legalinfo.mn/a': reply })
    await expect(fetchPage('https://legalinfo.mn/a', fetcher)).rejects.toThrow(
      code,
    )
  })

  it('reports a network failure', async () => {
    const { fetcher } = fakeFetch({})
    await expect(fetchPage('https://legalinfo.mn/a', fetcher)).rejects.toThrow(
      'network',
    )
  })
})
