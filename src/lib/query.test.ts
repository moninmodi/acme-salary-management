import { describe, expect, it } from 'vitest'

import { hasActiveFilters, readDirectoryQuery, readFilters, toSearchParams, withParams } from './query'

describe('query helpers', () => {
  it('drops empty values when serialising', () => {
    expect(toSearchParams({ a: 1, b: '', c: undefined, d: null, e: 'x' }).toString()).toBe('a=1&e=x')
  })

  it('reads only known, non-empty filters from the URL', () => {
    const sp = new URLSearchParams('country=India&search=%20%20&foo=bar&employment_status=Active')
    expect(readFilters(sp)).toEqual({ country: 'India', employment_status: 'Active' })
  })

  it('maps page and sort to API paging with safe defaults', () => {
    expect(readDirectoryQuery(new URLSearchParams('page=3&sort=salary&direction=desc'))).toMatchObject({
      offset: 50,
      limit: 25,
      sort: 'salary',
      direction: 'desc',
    })
    expect(readDirectoryQuery(new URLSearchParams('page=-2&sort=password&direction=up'))).toMatchObject({
      offset: 0,
      sort: 'name',
      direction: 'asc',
    })
  })

  it('applies and removes params without mutating the original', () => {
    const original = new URLSearchParams('country=India&page=4')
    const next = withParams(original, { country: undefined, department: 'Sales' })
    expect(next.toString()).toBe('page=4&department=Sales')
    expect(original.toString()).toBe('country=India&page=4')
  })

  it('detects active filters', () => {
    expect(hasActiveFilters({})).toBe(false)
    expect(hasActiveFilters({ department: 'Sales' })).toBe(true)
  })
})
