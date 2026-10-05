// A stand-in for this project's Supabase API in browser tests: the PostgREST reads and RPCs the
// site and the admin make, answered from the seed files (supabase/seed/) in memory. Every request
// to the API origin is answered here; nothing leaves the test machine.
import type { Page, Route } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const API_URL = 'https://e2e-test.supabase.co'
/** The key name supabase-js keeps the session under: `sb-<first host label>-auth-token`. */
const SESSION_KEY = 'sb-e2e-test-auth-token'

const SEED = fileURLToPath(new URL('../supabase/seed/', import.meta.url))
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'))

type Row = Record<string, unknown>
type Json = unknown

export const REVIEWER = {
  user_id: '20000000-0000-4000-8000-000000000001',
  name: 'Туршилтын хянагч',
  role: 'reviewer',
  email: 'reviewer@e2e.test',
}
export const EDITOR = {
  user_id: '20000000-0000-4000-8000-000000000002',
  name: 'Туршилтын редактор',
  role: 'editor',
  email: 'editor@e2e.test',
}

/** A copy without reviewer notes, as publish_story() and get_channels() hand it out. */
function stripNotes(value: Json): Json {
  if (Array.isArray(value)) return value.map(stripNotes)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== 'verify' && k !== 'draft')
        .map(([k, v]) => [k, stripNotes(v)]),
    )
  return value
}

function seedStories(): Row[] {
  return readdirSync(join(SEED, 'stories'))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((f) => readJson(join(SEED, 'stories', f)))
}

/** The tables and views the app reads, built from the seed. */
function buildTables() {
  const stories = seedStories()
  const published = stories
    .filter((s) => s.draft !== true)
    .map((s) => {
      const content = stripNotes(s) as Row
      const affects = (content.affects as { group: string }[]) ?? []
      return {
        id: content.id,
        content,
        type: content.type,
        stage: content.stage,
        featured: content.featured,
        sort_order: content.order ?? null,
        published_on: content.publishedAt,
        topics: content.topics,
        groups: [...new Set(affects.map((a) => a.group))].sort(),
        published_at: `${content.publishedAt}T04:00:00+00:00`,
      }
    })
  const cards = published.map((p) => ({
    ...p,
    title: p.content.title,
    summary: p.content.summary,
    timeline: p.content.timeline,
    source_count: (p.content.sources as unknown[]).length,
  }))
  const working = stories.map((s) => {
    const { draft, ...content } = s
    return {
      id: s.id,
      content,
      state: draft === true ? 'draft' : 'published',
      review_note: null,
      version: 1,
      created_by: EDITOR.user_id,
      created_at: '2026-09-27T04:00:00+00:00',
      updated_by: EDITOR.user_id,
      updated_at: '2026-09-27T04:00:00+00:00',
      submitted_by: null,
      submitted_at: null,
    }
  })
  return {
    published_stories: published as Row[],
    story_cards: cards as Row[],
    stories: working as Row[],
    staff: [REVIEWER, EDITOR].map(({ email: _, ...m }) => m) as Row[],
    settings: [
      {
        id: true,
        require_two_person_review: true,
        site_url: null,
        functions_url: null,
        deploy_hook_url: null,
      },
    ] as Row[],
    story_revisions: working.map((s, i) => ({
      id: i + 1,
      story_id: s.id,
      content: s.content,
      action: 'import',
      note: null,
      author: EDITOR.user_id,
      created_at: s.created_at,
    })) as Row[],
    reports: [] as Row[],
    watch_events: [] as Row[],
    channels: readJson(join(SEED, 'channels.json')) as Row[],
    taxRules: readJson(join(SEED, 'taxRules.json')) as Row,
  }
}

/** `story_admin_list`: the working copies with what the dashboard shows. */
function adminList(t: ReturnType<typeof buildTables>): Row[] {
  return t.stories.map((s) => {
    const live = t.published_stories.find((p) => p.id === s.id)
    const content = s.content as Row
    return {
      id: s.id,
      state: s.state,
      version: s.version,
      title: content.title,
      type: content.type,
      stage: content.stage,
      review_note: s.review_note,
      created_at: s.created_at,
      updated_at: s.updated_at,
      updated_by: s.updated_by,
      updated_by_name: EDITOR.name,
      submitted_at: null,
      submitted_by_name: null,
      is_live: Boolean(live),
      first_published_at: live?.published_at ?? null,
      published_at: live?.published_at ?? null,
      todo_count: JSON.stringify(content).split('TODO_VERIFY').length - 1,
    }
  })
}

// ---- a small PostgREST ---------------------------------------------------------------------------

function pick(row: Row, select: string | null): Row {
  if (!select || select === '*') return row
  const out: Row = {}
  for (const raw of select.split(',').map((s) => s.trim())) {
    if (raw === '*') Object.assign(out, row)
    const [alias, expr] = raw.includes(':') ? raw.split(':') : [null, raw]
    const [col, ...path] = expr.split(/->>?/)
    let value: unknown = row[col]
    for (const key of path)
      value = (value as Row | undefined)?.[key.replace(/^'|'$/g, '')]
    out[alias ?? path.at(-1) ?? col] = value ?? null
  }
  return out
}

function unquote(v: string) {
  return v.replace(/^"(.*)"$/, '$1')
}

function matches(row: Row, column: string, filter: string): boolean {
  const negate = filter.startsWith('not.')
  const f = negate ? filter.slice(4) : filter
  const dot = f.indexOf('.')
  const op = f.slice(0, dot)
  const arg = f.slice(dot + 1)
  const value = row[column]
  let ok: boolean
  switch (op) {
    case 'eq':
      ok = String(value) === arg
      break
    case 'in':
      ok = arg
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map(unquote)
        .includes(String(value))
      break
    case 'cs': {
      const wanted = arg
        .replace(/^\{|\}$/g, '')
        .split(',')
        .map(unquote)
      ok = wanted.every((w) => (value as unknown[] | null)?.includes(w))
      break
    }
    case 'is':
      ok = arg === 'null' ? value === null || value === undefined : false
      break
    default:
      throw new Error(`mock API: filter "${op}" is not supported`)
  }
  return negate ? !ok : ok
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  return a < b ? -1 : 1
}

function query(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows.filter((row) =>
    [...params].every(([key, filter]) =>
      ['select', 'order', 'limit', 'offset'].includes(key)
        ? true
        : matches(row, key, filter),
    ),
  )
  const order = params.get('order')
  if (order) {
    const keys = order.split(',').map((o) => {
      const [col, dir = 'asc', nulls] = o.split('.')
      return { col, desc: dir === 'desc', nullsFirst: nulls === 'nullsfirst' }
    })
    out = [...out].sort((x, y) => {
      for (const k of keys) {
        const a = x[k.col]
        const b = y[k.col]
        if (a === b) continue
        if (a === null || b === null)
          return (a === null) === k.nullsFirst ? -1 : 1
        const c = compare(a, b)
        return k.desc ? -c : c
      }
      return 0
    })
  }
  const limit = params.get('limit')
  return limit ? out.slice(0, Number(limit)) : out
}

// ---- the mock ------------------------------------------------------------------------------------

export type ApiCall = { name: string; args: Row }

export type MockApi = {
  /** every RPC the page called, with its arguments */
  calls: ApiCall[]
  tables: ReturnType<typeof buildTables>
}

const json = (route: Route, body: unknown, status = 200, headers = {}) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', ...headers },
    body: body === undefined ? '' : JSON.stringify(body),
  })

/** Answer every request to the API origin from the seed data. */
export async function mockApi(page: Page): Promise<MockApi> {
  const tables = buildTables()
  const calls: ApiCall[] = []

  async function rpc(route: Route, name: string, args: Row) {
    calls.push({ name, args })
    switch (name) {
      case 'get_channels':
        return json(route, stripNotes(tables.channels))
      case 'get_tax_rules':
        return json(route, stripNotes(tables.taxRules))
      case 'submit_report':
      case 'subscribe':
        return route.fulfill({ status: 204, body: '' })
      case 'follower_count':
        return json(route, 0)
      case 'publish_story': {
        const story = tables.stories.find((s) => s.id === args.p_id)
        if (!story) return json(route, { message: 'not_found' }, 404)
        if (story.version !== args.p_version)
          return json(route, { message: 'version_conflict' }, 409)
        story.state = 'published'
        story.version = Number(story.version) + 1
        return json(route, { id: story.id })
      }
      default:
        return json(route, { message: `mock API: no rpc ${name}` }, 404)
    }
  }

  await page.route(`${API_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })

    if (url.pathname.startsWith('/auth/v1/'))
      return json(route, { message: 'mock API: auth is not served' }, 400)

    const rpcMatch = /^\/rest\/v1\/rpc\/(\w+)$/.exec(url.pathname)
    if (rpcMatch) {
      const args =
        request.method() === 'GET'
          ? Object.fromEntries(url.searchParams)
          : (request.postDataJSON() ?? {})
      return rpc(route, rpcMatch[1], args)
    }

    const table = /^\/rest\/v1\/(\w+)$/.exec(url.pathname)?.[1]
    const source =
      table === 'story_admin_list'
        ? adminList(tables)
        : (tables as unknown as Record<string, Row[] | undefined>)[table ?? '']
    if (!source || !Array.isArray(source))
      return json(route, { message: `mock API: no table ${table}` }, 404)

    const found = query(source, url.searchParams)
    const select = url.searchParams.get('select')
    const rows = found.map((r) => pick(r, select))
    const headers: Record<string, string> = {
      'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
    }
    if (request.method() === 'HEAD')
      return route.fulfill({ status: 200, headers, body: '' })
    if ((request.headers()['accept'] ?? '').includes('vnd.pgrst.object'))
      return rows.length === 1
        ? json(route, rows[0], 200, headers)
        : json(route, { code: 'PGRST116', message: 'not one row' }, 406)
    return json(route, rows, 200, headers)
  })

  return { calls, tables }
}

/** A JWT-shaped token; the client only reads it, nothing checks the signature. */
function fakeJwt(payload: Row): string {
  const b64 = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature`
}

/** Start the page signed in as a staff member (the session supabase-js keeps in localStorage). */
export async function signIn(page: Page, member: typeof REVIEWER) {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600
  const user = {
    id: member.user_id,
    aud: 'authenticated',
    role: 'authenticated',
    email: member.email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-09-27T04:00:00Z',
  }
  const session = {
    access_token: fakeJwt({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: expiresAt,
    }),
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: expiresAt,
    refresh_token: 'e2e-refresh-token',
    user,
  }
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SESSION_KEY, JSON.stringify(session)],
  )
}
