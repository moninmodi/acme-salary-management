import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockApi, renderWithProviders } from '../test/utils'
import AskPanel from './AskPanel'

afterEach(() => vi.unstubAllGlobals())

describe('AskPanel', () => {
  it('explains how to enable the feature when Gemini is not configured', async () => {
    mockApi({ 'GET /api/features': () => ({ natural_language_questions: false }) })
    renderWithProviders(<AskPanel />)
    expect(await screen.findByText(/GEMINI_API_KEY/)).toBeInTheDocument()
    expect(screen.getByLabelText('Your question')).toBeDisabled()
  })

  it('shows the answer together with the verified insight, filters and figures', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /api/features': () => ({ natural_language_questions: true }),
      'POST /api/questions': () => ({
        answer: 'Engineering has the highest median salary in India at ₹38.5L.',
        tool_name: 'get_breakdown',
        group_by: 'department',
        filters: { country: 'India' },
        total_employees: null,
        results: [
          { group: 'Engineering', currency: 'INR', employee_count: 1100, payroll_minor: 1, average_minor: 1,
            median_minor: 385_000_000, min_minor: 1, max_minor: 2 },
        ],
        supported_examples: [],
      }),
    })
    renderWithProviders(<AskPanel />)

    const input = await screen.findByLabelText('Your question')
    await vi.waitFor(() => expect(input).toBeEnabled())
    await user.type(input, 'Which department pays most in India?{Enter}')

    expect(await screen.findByText(/highest median salary in India/)).toBeInTheDocument()
    expect(screen.getByText('Salary breakdown')).toBeInTheDocument()
    expect(screen.getByText('Country: India')).toBeInTheDocument()
    expect(screen.getByText('₹3,850,000')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ question: 'Which department pays most in India?' })
  })

  it('surfaces errors from the question endpoint', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /api/features': () => ({ natural_language_questions: true }),
      'POST /api/questions': () =>
        new Response(JSON.stringify({ detail: 'Could not map the question to one supported HR insight' }), { status: 422 }),
    })
    renderWithProviders(<AskPanel />)
    const input = await screen.findByLabelText('Your question')
    await vi.waitFor(() => expect(input).toBeEnabled())
    await user.type(input, 'What is the meaning of life?{Enter}')
    expect(await screen.findByText(/one supported HR insight/)).toBeInTheDocument()
  })
})
