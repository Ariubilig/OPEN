// Small HTTP helpers shared by the edge functions.

// Staff call the functions from the site with a bearer token (no cookies), so any origin is fine.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** HTTP status for a database error: 'PT403' → 403 (the RPC convention), anything else → 500. */
export function statusOf(error: { code?: string }): number {
  return /^PT\d{3}$/.test(error.code ?? '') ? Number(error.code!.slice(2)) : 500
}
