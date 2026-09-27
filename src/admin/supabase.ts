// The admin's Supabase client: auth (email code) plus the editorial RPCs. Loaded only with the
// admin chunk; the public site uses the smaller PostgREST client in src/data/client.ts.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../data/client'
import type { Database } from '../data/database.types'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in and invitation links come back to /admin/login with the session in the URL
    // fragment. Implicit flow: invitations are created on the server (no PKCE verifier in this
    // browser), and a sign-in link then also works when opened in another browser.
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
})

export type StaffRole = Database['public']['Enums']['staff_role']
export type StoryState = Database['public']['Enums']['story_state']
export type RevisionAction = Database['public']['Enums']['revision_action']
export type StaffMember = { user_id: string; name: string; role: StaffRole }

const RANK: Record<StaffRole, number> = { editor: 0, reviewer: 1, admin: 2 }

/** Roles are ordered: a reviewer can do what an editor can, an admin everything. */
export function hasRole(member: StaffMember, minimum: StaffRole): boolean {
  return RANK[member.role] >= RANK[minimum]
}

type Result = { data: unknown; error: unknown }
/** The `data` type of a successful response (Supabase results are success | failure unions). */
type Data<R> = Extract<R, { error: null }> extends { data: infer D } ? D : never

/** The data of a Supabase call that always returns data on success; its error is thrown. */
export async function call<R extends Result>(
  request: PromiseLike<R>,
): Promise<NonNullable<Data<R>>> {
  const result = await request
  if (result.error) throw result.error
  return result.data as NonNullable<Data<R>>
}

/** Like call(), for requests that may find nothing (maybeSingle, a lookup): null then. */
export async function maybe<R extends Result>(
  request: PromiseLike<R>,
): Promise<Data<R> | null> {
  const result = await request
  if (result.error) throw result.error
  return result.data as Data<R> | null
}
