// POST { email, name, role } — add someone to the team (admins only).
// An existing account is added directly; a new address gets an invitation email first.
// The admin check runs in the database with the caller's own session; the service role is used
// only to send the invitation.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { corsHeaders, json, statusOf } from '../_shared/http.ts'

const ROLES = ['editor', 'reviewer', 'admin']
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_input' }, 400)
  }
  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const role =
    typeof body.role === 'string' && ROLES.includes(body.role)
      ? body.role
      : null
  if (
    !EMAIL.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 100 ||
    !role
  ) {
    return json({ error: 'invalid_input' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const service = createClient(
    url,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )

  const existing = await asCaller.rpc('staff_user_id_by_email', {
    p_email: email,
  })
  if (existing.error)
    return json({ error: existing.error.message }, statusOf(existing.error))

  let userId = existing.data as string | null
  const invited = userId === null
  if (userId === null) {
    const settings = await service.from('settings').select('site_url').single()
    const siteUrl = settings.data?.site_url ?? req.headers.get('origin')
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl ? `${siteUrl}/admin/login` : undefined,
      data: { name },
    })
    if (error || !data.user) {
      console.error('invite failed', error)
      return json({ error: 'invite_failed' }, 502)
    }
    userId = data.user.id
  }

  const added = await asCaller.rpc('add_staff', {
    p_user_id: userId,
    p_name: name,
    p_role: role,
  })
  if (added.error)
    return json({ error: added.error.message }, statusOf(added.error))
  return json({ userId, invited })
})
