import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api, errorMessage } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('errorMessage', () => {
  it('passes through domain errors', () => {
    expect(errorMessage({ detail: 'Employee not found' }, 'x')).toBe('Employee not found')
  })
  it('flattens FastAPI validation errors', () => {
    const body = { detail: [{ loc: ['body', 'salary_minor'], msg: 'Input should be greater than or equal to 0' }] }
    expect(errorMessage(body, 'x')).toBe('salary_minor: Input should be greater than or equal to 0')
  })
  it('falls back for unknown bodies', () => expect(errorMessage(null, 'fallback')).toBe('fallback'))
})

describe('api', () => {
  it('throws ApiError with the status and server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Nope' }), { status: 409 })))
    await expect(api.employee(1)).rejects.toMatchObject({ name: 'ApiError', status: 409, message: 'Nope' })
  })

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await api.options().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toMatch(/Cannot reach the server/)
  })

  it('builds directory query strings and leaves search out of insight requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    await api.employees({ sort: 'name', direction: 'asc', limit: 25, offset: 0, country: 'India' })
    await api.breakdown('department', { search: 'asha', country: 'India' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/employees?sort=name&direction=asc&limit=25&offset=0&country=India')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/insights/breakdown?by=department&country=India')
  })
})
