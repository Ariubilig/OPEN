import { describe, expect, it } from 'vitest'
import {
  GENERATED_MARKER,
  jsonSchemas,
  schemaFromMigration,
  type SchemaName,
} from '../scripts/json-schemas'
import functionsSchema from '../supabase/functions/_shared/story-schema.json'

const migrations = import.meta.glob<string>('../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const latest = Object.keys(migrations)
  .sort()
  .map((file) => migrations[file])
  .filter((sql) => sql.startsWith(GENERATED_MARKER))
  .at(-1)

describe('database JSON Schemas', () => {
  it('has a generated migration', () => {
    expect(latest).toBeDefined()
  })

  // Fails when src/data/schema.ts changed without `npm run db:json-schema`.
  it.each(Object.keys(jsonSchemas) as SchemaName[])(
    '%s matches the zod contract',
    (name) => {
      expect(schemaFromMigration(latest!, name)).toEqual(jsonSchemas[name])
    },
  )

  // The edge functions' copy (the AI draft's schema); same command regenerates it.
  it('story-schema.json matches the zod contract', () => {
    expect(functionsSchema).toEqual(jsonSchemas.story)
  })

  it('checks the date format the zod refinement relies on', () => {
    const text = JSON.stringify(jsonSchemas.story)
    expect(text).toContain('"pattern":"^\\\\d{4}-\\\\d{2}-\\\\d{2}$"')
  })
})
