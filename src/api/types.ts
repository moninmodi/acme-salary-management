// Mirrors backend/schemas.py. Money is always an integer number of minor units plus an ISO currency.

export type EmploymentStatus = 'Active' | 'Inactive'

export interface FilterOptions {
  countries: string[]
  departments: string[]
  job_titles: string[]
  employment_statuses: string[]
  currencies: string[]
}

export interface Features {
  natural_language_questions: boolean
}

/** Population filters shared by the directory, summary and insight endpoints. */
export interface PopulationFilters {
  search?: string
  country?: string
  department?: string
  job_title?: string
  employment_status?: string
}

export type SortField = 'name' | 'salary' | 'country' | 'department'
export type SortDirection = 'asc' | 'desc'

export interface DirectoryQuery extends PopulationFilters {
  sort: SortField
  direction: SortDirection
  limit: number
  offset: number
}

export interface Employee {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  email: string
  country: string
  department: string
  job_title: string
  employment_status: EmploymentStatus
  created_at: string
  salary_minor: number | null
  currency: string | null
  salary_effective_date: string | null
}

export interface EmployeePage {
  items: Employee[]
  total: number
  limit: number
  offset: number
  as_of: string
}

export interface CurrencySalarySummary {
  currency: string
  employee_count: number
  payroll_minor: number
  average_minor: number
  median_minor: number
  min_minor: number
  max_minor: number
}

export interface DashboardSummary {
  total_employees: number
  by_country: { country: string; employee_count: number }[]
  by_department: { department: string; employee_count: number }[]
  salary_by_currency: CurrencySalarySummary[]
}

export interface SalaryRecord {
  id: number
  previous_salary_minor: number | null
  previous_currency: string | null
  new_salary_minor: number
  currency: string
  effective_date: string
  reason: string
  changed_by: string
  changed_at: string
}

export interface SalaryRecordCreate {
  salary_minor: number
  currency: string
  effective_date: string
  reason: string
}

export interface SalaryRecordCreated {
  id: number
  employee_id: number
  salary_minor: number
  currency: string
  effective_date: string
  status: 'current' | 'scheduled'
  changed_at: string
}

export type BreakdownDimension = 'country' | 'department' | 'designation' | 'employment_status' | 'currency'

export interface BreakdownRow {
  group: string | null
  currency: string
  employee_count: number
  payroll_minor: number
  average_minor: number
  median_minor: number
  min_minor: number
  max_minor: number
}

export interface BreakdownReport {
  group_by: BreakdownDimension
  filters: Record<string, string>
  results: BreakdownRow[]
}

export interface OutlierSummary {
  currency: string
  employee_count: number
  q1_minor: number
  q3_minor: number
  lower_fence_minor: number
  upper_fence_minor: number
  lower_outlier_count: number
  upper_outlier_count: number
  outlier_count: number
}

export interface OutlierReport {
  filters: Record<string, string>
  iqr_multiplier: number
  results: OutlierSummary[]
}

export type InsightTool = 'get_summary' | 'get_breakdown' | 'get_outliers'

/** Rows returned by the question endpoint: the verified aggregate behind the answer. */
export type QuestionResultRow = Partial<BreakdownRow & OutlierSummary> & { currency: string }

export interface QuestionResponse {
  answer: string
  tool_name: InsightTool
  group_by: string | null
  filters: Record<string, string>
  total_employees: number | null
  results: QuestionResultRow[]
  supported_examples: string[]
}
