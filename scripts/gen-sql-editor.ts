// Writes supabase/setup/schema.sql: every migration in one file for the Supabase SQL editor.
// Run: npm run db:sql-editor (after adding a migration; a test fails until you do).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA_FILE, schemaSql } from './sql-editor.ts'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const MIGRATIONS = join(ROOT, 'supabase/migrations')

const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .map((name) => ({
    name,
    sql: readFileSync(join(MIGRATIONS, name), 'utf8'),
  }))

writeFileSync(join(ROOT, SCHEMA_FILE), schemaSql(migrations))
console.log(`wrote ${SCHEMA_FILE} — ${migrations.length} migrations`)
