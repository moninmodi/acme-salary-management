import { toSearchParams } from '../lib/query'
import type {
  BreakdownDimension,
  BreakdownReport,
  DashboardSummary,
  DirectoryQuery,
  Employee,
  EmployeePage,
  Features,
  FilterOptions,
  OutlierReport,
  PopulationFilters,
  QuestionResponse,
  SalaryRecord,
  SalaryRecordCreate,
  SalaryRecordCreated,
} from './types'

const API_ROOT = '/api'

/** HTTP error carrying the status code and the server's user-facing message. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** FastAPI sends {detail: string} for domain errors and {detail: [{loc, msg}]} for validation errors. */
export function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item: { loc?: (string | number)[]; msg?: string }) => {
        const field = item.loc?.filter((part) => part !== 'body' && part !== 'query').join('.')
        return field ? `${field}: ${item.msg}` : (item.msg ?? '')
      })
      .join('; ')
  }
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(body, 'The service could not complete this request.'))
  }
  return body as T
}

const qs = (params: object): string => {
  const text = toSearchParams(params).toString()
  return text ? `?${text}` : ''
}

export const api = {
  options: () => request<FilterOptions>('/options'),
  features: () => request<Features>('/features'),
  employees: (query: DirectoryQuery) => request<EmployeePage>(`/employees${qs(query)}`),
  employee: (id: number) => request<Employee>(`/employees/${id}`),
  salaryHistory: (id: number) => request<{ items: SalaryRecord[] }>(`/employees/${id}/history`),
  addSalaryRecord: (id: number, record: SalaryRecordCreate) =>
    request<SalaryRecordCreated>(`/employees/${id}/salaries`, { method: 'POST', body: JSON.stringify(record) }),
  summary: (filters: PopulationFilters) => request<DashboardSummary>(`/summary${qs(filters)}`),
  breakdown: (by: BreakdownDimension, filters: PopulationFilters & { currency?: string }) =>
    request<BreakdownReport>(`/insights/breakdown${qs({ by, ...withoutSearch(filters) })}`),
  outliers: (filters: PopulationFilters) =>
    request<OutlierReport>(`/insights/outliers${qs(withoutSearch(filters))}`),
  ask: (question: string) =>
    request<QuestionResponse>('/questions', { method: 'POST', body: JSON.stringify({ question }) }),
}

/** Insight endpoints aggregate whole populations, so free-text name search does not apply to them. */
function withoutSearch<T extends PopulationFilters>(filters: T): Omit<T, 'search'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { search, ...rest } = filters
  return rest
}
