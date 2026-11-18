import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEmployee } from '../api/hooks'
import type { Employee } from '../api/types'
import { mockApi, renderWithProviders } from '../test/utils'
import SalaryRecordForm from './SalaryRecordForm'

const employee: Employee = {
  id: 7,
  employee_code: 'AC-00007',
  first_name: 'Asha',
  last_name: 'Shah',
  email: 'asha@acme.example',
  country: 'India',
  department: 'Engineering',
  job_title: 'Software Engineer',
  employment_status: 'Active',
  created_at: '2026-11-18T09:00:00+00:00',
  salary_minor: 250_000_000,
  currency: 'INR',
  salary_effective_date: '2026-04-01',
}

afterEach(() => vi.unstubAllGlobals())

describe('SalaryRecordForm', () => {
  it('pre-fills the current salary and posts minor units with a reason', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'POST /api/employees/7/salaries': () => ({
        id: 1, employee_id: 7, salary_minor: 275_000_000, currency: 'INR',
        effective_date: '2026-11-18', status: 'current', changed_at: '2026-11-18T09:00:00+00:00',
      }),
    })
    renderWithProviders(<SalaryRecordForm employee={employee} currencies={['INR', 'USD']} />)

    const amount = screen.getByLabelText('New annual salary', { selector: 'input' })
    expect(amount).toHaveValue('2500000')
    await user.clear(amount)
    await user.type(amount, '2750000')
    expect(await screen.findByText(/\+10\.0% vs current/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Reason for change', { selector: 'textarea' }), 'Promotion to L3')
    await user.click(screen.getByRole('button', { name: /save salary record/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({ salary_minor: 275_000_000, currency: 'INR', reason: 'Promotion to L3' })
    expect(body.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('confirms the save even though the employee is refetched with the new salary mid-save', async () => {
    // Regression: resetting the mutation when the salary prop changed swallowed the success message.
    const user = userEvent.setup()
    let current = employee
    mockApi({
      'GET /api/employees/7': () => current,
      'POST /api/employees/7/salaries': () => {
        current = { ...employee, salary_minor: 275_000_000, salary_effective_date: '2026-11-18' }
        return { id: 2, employee_id: 7, salary_minor: 275_000_000, currency: 'INR',
          effective_date: '2026-11-18', status: 'current', changed_at: '2026-11-18T09:00:00+00:00' }
      },
    })
    function LiveForm() {
      const { data } = useEmployee(7)
      return data ? <SalaryRecordForm employee={data} currencies={['INR']} /> : null
    }
    renderWithProviders(<LiveForm />)

    const amount = await screen.findByLabelText('New annual salary', { selector: 'input' })
    await user.clear(amount)
    await user.type(amount, '2750000')
    await user.type(screen.getByLabelText('Reason for change', { selector: 'textarea' }), 'Promotion')
    await user.click(screen.getByRole('button', { name: /save salary record/i }))

    expect(await screen.findByText('Salary record saved and now current')).toBeInTheDocument()
    await waitFor(() => expect(amount).toHaveValue('2750000'))
  })

  it('blocks submission without a reason or with an invalid amount', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({})
    renderWithProviders(<SalaryRecordForm employee={employee} currencies={['INR']} />)

    const amount = screen.getByLabelText('New annual salary', { selector: 'input' })
    await user.clear(amount)
    await user.type(amount, '12.345')
    await user.click(screen.getByRole('button', { name: /save salary record/i }))

    expect(await screen.findByText('Enter an amount with up to two decimal places.')).toBeInTheDocument()
    expect(await screen.findByText('A reason is required for the audit trail')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server error when the record is rejected', async () => {
    const user = userEvent.setup()
    mockApi({
      'POST /api/employees/7/salaries': () =>
        new Response(JSON.stringify({ detail: 'Effective date must be after the latest scheduled salary record' }), {
          status: 422,
        }),
    })
    renderWithProviders(<SalaryRecordForm employee={employee} currencies={['INR']} />)
    await user.type(screen.getByLabelText('Reason for change', { selector: 'textarea' }), 'Annual review')
    await user.click(screen.getByRole('button', { name: /save salary record/i }))
    expect(await screen.findByText(/must be after the latest scheduled/)).toBeInTheDocument()
  })
})
