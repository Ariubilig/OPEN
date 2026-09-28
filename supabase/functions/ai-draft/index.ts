// POST { storyId, type, stage, source: { title, publisher, url, publishedAt?, kind },
//        documentText, instructions? } — staff only.
//
// Starts a background job and answers 202 { jobId } at once (a draft can take longer than a
// request may stay open). The job asks Claude for a story in the schema, from that one document,
// and saves it as a working copy in the caller's name (revision 'ai_draft'). The admin watches
// the job in public.ai_drafts. Needs the ANTHROPIC_API_KEY secret; ANTHROPIC_MODEL and
// ANTHROPIC_EFFORT are optional.
import Anthropic from 'npm:@anthropic-ai/sdk@0.128.0'
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import storySchema from '../_shared/story-schema.json' with { type: 'json' }
import {
  draftStory,
  modelSchema,
  readInput,
  SYSTEM_PROMPT,
  userPrompt,
  type DraftInput,
} from '../_shared/aiDraft.ts'
import { corsHeaders, json } from '../_shared/http.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5'
const EFFORT = (Deno.env.get('ANTHROPIC_EFFORT') ?? 'high') as
  'low' | 'medium' | 'high'
const SCHEMA = modelSchema(storySchema as Record<string, unknown>)

const url = Deno.env.get('SUPABASE_URL')!
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const asCaller = (authorization: string) =>
  createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

const todayInUlaanbaatar = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar' }).format(
    new Date(),
  )

/** Seconds the caller's access token stays valid (the draft is saved with it at the end). */
function secondsLeft(authorization: string): number {
  try {
    const payload = authorization
      .split('.')[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
    return (
      (JSON.parse(atob(payload)) as { exp: number }).exp - Date.now() / 1000
    )
  } catch {
    return 0
  }
}
// a job longer than this is marked failed (expire_ai_drafts); the token must outlive it
const MIN_TOKEN_SECONDS = 20 * 60

/** Ask Claude, save the draft, record how it went. Never throws. */
async function draft(jobId: number, input: DraftInput, authorization: string) {
  let outcome: Record<string, unknown>
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY
    const message = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        // a declined request is retried on the model Anthropic recommends for that category
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: {
          effort: EFFORT,
          format: { type: 'json_schema', schema: SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(input) }],
      })
      .finalMessage()

    if (message.stop_reason === 'refusal') throw new Error('refusal')
    if (message.stop_reason === 'max_tokens') throw new Error('too_long')
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('')
    const output = JSON.parse(text) as Record<string, unknown>
    const story = draftStory(output, input, message.model, todayInUlaanbaatar())

    const created = await asCaller(authorization).rpc('create_story', {
      p_id: input.storyId,
      p_content: story,
      p_action: 'ai_draft',
    })
    if (created.error) throw new Error(created.error.message)
    outcome = { status: 'done', model: message.model, usage: message.usage }
  } catch (e) {
    const error =
      e instanceof Anthropic.APIError
        ? `anthropic_${e.status ?? 'error'}: ${e.message}`
        : e instanceof SyntaxError
          ? 'invalid_json'
          : e instanceof Error
            ? e.message
            : String(e)
    console.error(`ai draft ${jobId}`, error)
    outcome = { status: 'failed', error: error.slice(0, 1000) }
  }
  await service
    .from('ai_drafts')
    .update({ ...outcome, finished_at: new Date().toISOString() })
    .eq('id', jobId)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'unauthorized' }, 401)
  if (!Deno.env.get('ANTHROPIC_API_KEY'))
    return json({ error: 'ai_not_configured' }, 503)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_input' }, 400)
  }
  const read = readInput(body, storySchema as Record<string, unknown>)
  if ('error' in read) return json({ error: read.error }, 400)
  const { input } = read

  // staff only: the caller's own session must see a staff row for them
  const caller = asCaller(authorization)
  const { data: userData } = await caller.auth.getUser()
  const userId = userData.user?.id
  const member = userId
    ? await caller
        .from('staff')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle()
    : null
  if (!userId || !member?.data) return json({ error: 'forbidden' }, 403)
  // the admin refreshes its session first; a token about to expire could not save the draft
  if (secondsLeft(authorization) < MIN_TOKEN_SECONDS)
    return json({ error: 'session_expiring' }, 401)

  await service.rpc('expire_ai_drafts')
  const [taken, running] = await Promise.all([
    service.from('stories').select('id').eq('id', input.storyId).maybeSingle(),
    service
      .from('ai_drafts')
      .select('id')
      .eq('story_id', input.storyId)
      .eq('status', 'running')
      .maybeSingle(),
  ])
  if (taken.data) return json({ error: 'id_taken' }, 409)
  if (running.data) return json({ error: 'already_running' }, 409)

  const { documentText, ...asked } = input
  const job = await service
    .from('ai_drafts')
    .insert({
      story_id: input.storyId,
      input: asked,
      document_chars: documentText.length,
      model: MODEL,
      created_by: userId,
    })
    .select('id')
    .single()
  if (job.error) {
    console.error('ai_drafts insert', job.error)
    return json({ error: 'failed' }, 500)
  }

  EdgeRuntime.waitUntil(draft(job.data.id, input, authorization))
  return json({ jobId: job.data.id }, 202)
})
