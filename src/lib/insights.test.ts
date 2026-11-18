import { describe, expect, it } from 'vitest'

import type { BreakdownRow, Employee, SalaryRecord } from '../api/types'
import { defaultCurrency, recordStatus } from './insights'

const row = (currency: string, employee_count: number) => ({ currency, employee_count }) as BreakdownRow

describe('defaultCurrency', () => {
  it('picks the currency with the most employees', () => {
    expect(defaultCurrency([row('USD', 10), row('INR', 7), row('INR', 8)])).toBe('INR')
  })
  it('is undefined when there is no data', () => expect(defaultCurrency([])).toBeUndefined())
})

describe('recordStatus', () => {
  const employee = { salary_effective_date: '2026-04-01' } as Employee
  const rec = (effective_date: string) => ({ effective_date }) as SalaryRecord
  it('classifies scheduled, current and historical records', () => {
    expect(recordStatus(rec('2027-04-01'), employee, '2026-11-18')).toBe('Scheduled')
    expect(recordStatus(rec('2026-04-01'), employee, '2026-11-18')).toBe('Current')
    expect(recordStatus(rec('2025-04-01'), employee, '2026-11-18')).toBe('Historical')
  })
})
