import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { App as AntApp } from 'antd'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

/** Render with the same providers as the app, using a fresh query cache per test. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AntApp>
    </QueryClientProvider>,
  )
}

type Handler = (init?: RequestInit) => unknown

/** Stub fetch with handlers keyed by "METHOD /path" (query string ignored); returns the mock. */
export function mockApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init?.method ?? 'GET'} ${url.pathname}`
    const handler = handlers[key]
    if (!handler) return new Response(JSON.stringify({ detail: `No mock for ${key}` }), { status: 404 })
    const body = handler(init)
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
