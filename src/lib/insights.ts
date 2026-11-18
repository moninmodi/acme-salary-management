import type { BreakdownRow, Employee, SalaryRecord } from '../api/types'

export const EXAMPLE_QUESTIONS = [
  'What is the median salary by department in India?',
  'How many employees are in Germany?',
  'Show salary statistics by designation in the United States.',
  'How many salary outliers are there in INR?',
]

/** Pick the currency with the most employees so a chart opens on the biggest population. */
export function defaultCurrency(rows: BreakdownRow[]): string | undefined {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.currency, (counts.get(row.currency) ?? 0) + row.employee_count)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
}

export type RecordStatus = 'Scheduled' | 'Current' | 'Historical'

/** Classify a salary record relative to today and the employee's current effective date. */
export function recordStatus(record: SalaryRecord, employee: Employee, today: string): RecordStatus {
  if (record.effective_date > today) return 'Scheduled'
  return record.effective_date === employee.salary_effective_date ? 'Current' : 'Historical'
}
