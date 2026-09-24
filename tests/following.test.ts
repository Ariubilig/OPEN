import { describe, expect, it } from 'vitest'
import { parseFollowing, toggled } from '../src/lib/following'

describe('parseFollowing', () => {
  it('reads a stored list of ids', () => {
    expect(parseFollowing('["a","b"]')).toEqual(['a', 'b'])
  })

  it('treats missing or broken storage as an empty list', () => {
    expect(parseFollowing(null)).toEqual([])
    expect(parseFollowing('{oops')).toEqual([])
    expect(parseFollowing('{"a":1}')).toEqual([])
  })

  it('drops non-strings and duplicates', () => {
    expect(parseFollowing('["a",1,null,"a","b"]')).toEqual(['a', 'b'])
  })
})

describe('toggled', () => {
  it('adds a new id first and removes a followed one', () => {
    expect(toggled(['a'], 'b')).toEqual(['b', 'a'])
    expect(toggled(['b', 'a'], 'b')).toEqual(['a'])
  })
})
