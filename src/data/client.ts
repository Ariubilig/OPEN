// The public site's connection to Supabase: PostgREST only (reads and a few anonymous RPCs).
// The admin uses the full supabase-js client with auth (src/admin/supabase.ts).
import { PostgrestClient } from '@supabase/postgrest-js'
import type { Database } from './database.types'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** True when the build has the Supabase URL and public key. */
export const configured = SUPABASE_URL !== '' && SUPABASE_KEY !== ''

// Legacy anon keys are JWTs and also go in the Authorization header; publishable keys
// (sb_publishable_…) only in `apikey`.
const isJwt = (key: string) => key.split('.').length === 3

export const db = new PostgrestClient<Database>(`${SUPABASE_URL}/rest/v1`, {
  headers: {
    apikey: SUPABASE_KEY,
    ...(isJwt(SUPABASE_KEY) ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
  },
})
