import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type { BreakdownDimension, DirectoryQuery, PopulationFilters, SalaryRecordCreate } from './types'

export const keys = {
  options: ['options'] as const,
  features: ['features'] as const,
  employees: ['employees'] as const,
  directory: (q: DirectoryQuery) => ['employees', 'page', q] as const,
  employee: (id: number) => ['employees', 'detail', id] as const,
  history: (id: number) => ['employees', 'history', id] as const,
  reports: ['reports'] as const,
}

export const useFilterOptions = () => useQuery({ queryKey: keys.options, queryFn: api.options, staleTime: 300_000 })

export const useFeatures = () => useQuery({ queryKey: keys.features, queryFn: api.features, staleTime: 300_000 })

export const useDirectory = (query: DirectoryQuery) =>
  useQuery({
    queryKey: keys.directory(query),
    queryFn: () => api.employees(query),
    placeholderData: keepPreviousData, // keep rows on screen while the next page loads
  })

export const useEmployee = (id: number | null) =>
  useQuery({ queryKey: keys.employee(id ?? 0), queryFn: () => api.employee(id!), enabled: id !== null })

export const useSalaryHistory = (id: number | null) =>
  useQuery({ queryKey: keys.history(id ?? 0), queryFn: () => api.salaryHistory(id!), enabled: id !== null })

export const useSummary = (filters: PopulationFilters) =>
  useQuery({
    queryKey: [...keys.reports, 'summary', filters],
    queryFn: () => api.summary(filters),
    placeholderData: keepPreviousData,
  })

export const useBreakdown = (by: BreakdownDimension, filters: PopulationFilters) =>
  useQuery({
    queryKey: [...keys.reports, 'breakdown', by, filters],
    queryFn: () => api.breakdown(by, filters),
    placeholderData: keepPreviousData,
  })

export const useOutliers = (filters: PopulationFilters) =>
  useQuery({ queryKey: [...keys.reports, 'outliers', filters], queryFn: () => api.outliers(filters) })

/** Append a salary record, then refresh everything that depends on current pay. */
export function useAddSalaryRecord(employeeId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (record: SalaryRecordCreate) => api.addSalaryRecord(employeeId, record),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.employees }),
        client.invalidateQueries({ queryKey: keys.reports }),
      ]),
  })
}

export const useAskQuestion = () => useMutation({ mutationFn: (question: string) => api.ask(question) })
