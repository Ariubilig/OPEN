// POST { ids?: number[] } — checks the watched official pages (public.watched_documents).
//
// pg_cron calls it every hour: pages not checked for 20 hours, so each about once a day. Staff
// (their own session) can check sooner: "check now" takes pages not checked for 6 hours, and
// `ids` checks those pages at once. At most 10 pages per call; the rest wait for the next run.
// Each page's text is compared with the last fetch; a difference becomes a watch_events row.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { corsHeaders, json } from '../_shared/http.ts'
import { fetchPage } from '../_shared/watch.ts'

const SCHEDULE = '20 hours'
const CHECK_NOW = '6 hours'
const LIMIT = 10
const PARALLEL = 4

const url = Deno.env.get('SUPABASE_URL')!
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** True when the request carries the session of a staff member. */
async function isStaff(authorization: string | null): Promise<boolean> {
  if (!authorization) return false
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await caller.auth.getUser()
  if (!data.user) return false
  const member = await caller
    .from('staff')
    .select('role')
    .eq('user_id', data.user.id)
    .maybeSingle()
  return Boolean(member.data)
}

type Claimed = { id: number; url: string }
type Result = { id: number; status: string; error?: string }

async function check(doc: Claimed): Promise<Result> {
  let hash: string | null = null
  let text: string | null = null
  let error: string | null = null
  try {
    const page = await fetchPage(doc.url)
    hash = page.hash
    text = page.text
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const { data, error: failed } = await service.rpc('record_watch_result', {
    p_id: doc.id,
    p_hash: hash,
    p_text: text,
    p_error: error,
  })
  if (failed) {
    console.error(`watch ${doc.id}`, failed)
    return { id: doc.id, status: 'error', error: 'record_failed' }
  }
  return { id: doc.id, status: data as string, ...(error ? { error } : {}) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is number => Number.isSafeInteger(id))
    : null
  if (ids && (ids.length === 0 || ids.length > LIMIT))
    return json({ error: 'invalid_input' }, 400)

  // anyone may trigger the schedule (it only takes pages that are due); sooner is for staff
  const staff = await isStaff(req.headers.get('Authorization'))
  if (ids && !staff) return json({ error: 'forbidden' }, 403)

  const { data, error } = await service.rpc('claim_watched_documents', {
    p_min_age: ids ? '0 seconds' : staff ? CHECK_NOW : SCHEDULE,
    p_ids: ids,
    p_limit: LIMIT,
  })
  if (error) {
    console.error('claim_watched_documents', error)
    return json({ error: 'claim_failed' }, 500)
  }

  const queue = [...((data ?? []) as Claimed[])]
  const results: Result[] = []
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let doc = queue.shift(); doc; doc = queue.shift())
        results.push(await check(doc))
    }),
  )
  const count = (status: string) =>
    results.filter((r) => r.status === status).length
  return json({
    checked: results.length,
    changed: count('changed'),
    errors: count('error'),
    results,
  })
})
