import type { DirectoryQuery, PopulationFilters, SortDirection, SortField } from '../api/types'

export const PAGE_SIZE = 25
export const FILTER_KEYS = ['search', 'country', 'department', 'job_title', 'employment_status'] as const
const SORT_FIELDS: SortField[] = ['name', 'salary', 'country', 'department']

/** Serialise an object to a query string, skipping empty values so URLs stay short. */
export function toSearchParams(params: object): URLSearchParams {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    out.set(key, String(value))
  }
  return out
}

/** Read population filters from the URL; the URL is the source of truth so views can be shared. */
export function readFilters(sp: URLSearchParams): PopulationFilters {
  const filters: PopulationFilters = {}
  for (const key of FILTER_KEYS) {
    const value = sp.get(key)?.trim()
    if (value) filters[key] = value
  }
  return filters
}

/** Read the directory's page and sort state, falling back to safe defaults for invalid input. */
export function readDirectoryQuery(sp: URLSearchParams): DirectoryQuery {
  const page = Number(sp.get('page'))
  const sort = sp.get('sort') as SortField | null
  const direction: SortDirection = sp.get('direction') === 'desc' ? 'desc' : 'asc'
  return {
    ...readFilters(sp),
    sort: sort && SORT_FIELDS.includes(sort) ? sort : 'name',
    direction,
    limit: PAGE_SIZE,
    offset: Number.isInteger(page) && page > 1 ? (page - 1) * PAGE_SIZE : 0,
  }
}

/** Return a copy of ``sp`` with ``changes`` applied; empty values remove the key. */
export function withParams(sp: URLSearchParams, changes: Record<string, string | number | undefined>): URLSearchParams {
  const next = new URLSearchParams(sp)
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '' || value === null) next.delete(key)
    else next.set(key, String(value))
  }
  return next
}

export const hasActiveFilters = (filters: PopulationFilters): boolean => Object.values(filters).some(Boolean)
