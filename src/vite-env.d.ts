/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase API URL, e.g. https://<ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (or legacy anon) key — public by design */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
