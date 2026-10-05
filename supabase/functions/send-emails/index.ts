// Sends what is waiting in email_outbox (confirmations, stage changes). Called by the database
// when an email is queued and every 10 minutes for retries; calling it again sends nothing new.
//
// Delivery: Resend when RESEND_API_KEY is set (EMAIL_FROM: a verified sender, e.g.
// "Тод <alerts@example.mn>"); otherwise the local inbox when MAILPIT_URL is set (development);
// otherwise the email is marked 'skipped', so nothing piles up before mail is configured.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { renderEmail, type Email } from '../_shared/emails.ts'
import { corsHeaders, json } from '../_shared/http.ts'

type Claimed = {
  id: number
  to_email: string
  template: string
  data: Record<string, unknown>
  attempts: number
  site_url: string | null
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const MAILPIT_URL = Deno.env.get('MAILPIT_URL')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? ''

/** "Name <address>" → its parts (Mailpit wants them separately). */
function sender(from: string) {
  const m = /^(.*)<([^>]+)>\s*$/.exec(from)
  return m
    ? { Name: m[1].trim(), Email: m[2].trim() }
    : { Name: '', Email: from.trim() }
}

async function deliver(to: string, email: Email): Promise<'sent' | 'skipped'> {
  if (RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: email.unsubscribe
          ? { 'List-Unsubscribe': `<${email.unsubscribe}>` }
          : undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok)
      throw new Error(`Resend ${response.status}: ${await response.text()}`)
    return 'sent'
  }
  if (MAILPIT_URL) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: sender(EMAIL_FROM || 'alerts@localhost'),
        To: [{ Email: to }],
        Subject: email.subject,
        Text: email.text,
        HTML: email.html,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok)
      throw new Error(`Mailpit ${response.status}: ${await response.text()}`)
    return 'sent'
  }
  return 'skipped'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      db: { schema: 'open' },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const { data, error } = await service.rpc('claim_emails', { p_limit: 50 })
  if (error) {
    console.error('claim_emails', error)
    return json({ error: 'claim_failed' }, 500)
  }

  const counts = { sent: 0, skipped: 0, failed: 0 }
  for (const email of (data ?? []) as Claimed[]) {
    let status: 'sent' | 'skipped' | 'failed'
    let problem: string | null = null
    try {
      if (!email.site_url)
        throw new Error('settings.site_url is not set: links cannot be written')
      status = await deliver(
        email.to_email,
        renderEmail(email.template, email.data, email.site_url),
      )
      if (status === 'skipped')
        problem = 'no mail service configured (RESEND_API_KEY)'
    } catch (e) {
      status = 'failed'
      problem = e instanceof Error ? e.message : String(e)
      console.error(`email ${email.id}`, problem)
    }
    counts[status]++
    await service.rpc('finish_email', {
      p_id: email.id,
      p_status: status,
      p_error: problem,
    })
  }
  return json(counts)
})
