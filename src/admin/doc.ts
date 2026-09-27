// Immutable edits of JSON documents by path, e.g. setIn(story, ['meaning', 2, 'text'], '…').
// `undefined` removes an object key (optional fields left empty disappear from the document).

export type Path = readonly (string | number)[]

export function getIn(value: unknown, path: Path): unknown {
  let current = value
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}

export function setIn<T>(value: T, path: Path, next: unknown): T {
  if (path.length === 0) return next as T
  const [key, ...rest] = path
  if (typeof key === 'number') {
    const list = Array.isArray(value) ? [...value] : []
    list[key] = setIn(list[key], rest, next)
    return list as T
  }
  const object =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {}
  const child = setIn(object[key], rest, next)
  if (child === undefined) delete object[key]
  else object[key] = child
  return object as T
}

/** Insert `item` into the list at `path` (at the end by default). */
export function insertIn<T>(
  value: T,
  path: Path,
  item: unknown,
  index?: number,
): T {
  const list = [...((getIn(value, path) as unknown[] | undefined) ?? [])]
  list.splice(index ?? list.length, 0, item)
  return setIn(value, path, list)
}

export function removeIn<T>(value: T, path: Path, index: number): T {
  const list = [...((getIn(value, path) as unknown[] | undefined) ?? [])]
  list.splice(index, 1)
  return setIn(value, path, list)
}

/** Move item `index` of the list at `path` by `delta` (−1 up, +1 down). */
export function moveIn<T>(
  value: T,
  path: Path,
  index: number,
  delta: number,
): T {
  const list = [...((getIn(value, path) as unknown[] | undefined) ?? [])]
  const to = index + delta
  if (to < 0 || to >= list.length) return value
  const [item] = list.splice(index, 1)
  list.splice(to, 0, item)
  return setIn(value, path, list)
}

/** `['meaning', 2, 'text']` → `$.meaning[2].text` (the paths validation messages use). */
export function toJsonPath(path: Path): string {
  return path.reduce<string>(
    (acc, key) =>
      typeof key === 'number' ? `${acc}[${key}]` : `${acc}.${key}`,
    '$',
  )
}
