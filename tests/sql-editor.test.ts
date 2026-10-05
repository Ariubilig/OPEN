import { describe, expect, it } from 'vitest'
import { GENERATED_MARKER, schemaSql } from '../scripts/sql-editor'
import schemaFile from '../supabase/setup/schema.sql?raw'

const migrations = import.meta.glob<string>('../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const list = Object.entries(migrations).map(([path, sql]) => ({
  name: path.split('/').at(-1)!,
  sql,
}))

describe('SQL editor setup file', () => {
  // Fails when a migration was added or changed without `npm run db:sql-editor`.
  it('is every migration, in order', () => {
    expect(schemaFile).toBe(schemaSql(list))
  })

  it('lists every migration version for `migration repair`', () => {
    const repair = /migration repair .* applied (.*)/.exec(schemaFile)![1]
    expect(repair.split(' ')).toEqual(
      list.map((m) => m.name.split('_')[0]).sort(),
    )
  })

  it('keeps the migrations in file order', () => {
    const order = [
      ...schemaFile.matchAll(/^-- supabase\/migrations\/(\S+\.sql)$/gm),
    ]
    expect(order.map((m) => m[1])).toEqual(list.map((m) => m.name).sort())
    expect(schemaFile.startsWith(GENERATED_MARKER)).toBe(true)
  })
})
