// Writes the JSON Schema migration from the zod contract. Run: npm run db:json-schema
//
// Migrations are append-only once pushed, so a changed contract gets a new migration file.
// `--replace` rewrites the newest generated migration in place instead (only for one that has
// not been pushed to any remote database yet).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERATED_MARKER, jsonSchemaMigration } from './json-schemas.ts'

const MIGRATIONS = fileURLToPath(
  new URL('../supabase/migrations/', import.meta.url),
)
const replace = process.argv.includes('--replace')

const latest = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .filter((f) =>
    readFileSync(join(MIGRATIONS, f), 'utf8').startsWith(GENERATED_MARKER),
  )
  .at(-1)

const sql = jsonSchemaMigration()

if (latest && readFileSync(join(MIGRATIONS, latest), 'utf8') === sql) {
  console.log(`up to date: supabase/migrations/${latest}`)
} else if (latest && replace) {
  writeFileSync(join(MIGRATIONS, latest), sql)
  console.log(`rewrote supabase/migrations/${latest}`)
} else {
  // UTC timestamp in the CLI's format: YYYYMMDDHHMMSS
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const file = `${stamp}_json_schemas.sql`
  writeFileSync(join(MIGRATIONS, file), sql)
  console.log(`wrote supabase/migrations/${file}`)
}
