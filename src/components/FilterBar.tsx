import { ClearOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Flex, Input, Select } from 'antd'
import { useEffect, useState } from 'react'

import type { FilterOptions, PopulationFilters } from '../api/types'
import { countryFlag } from '../lib/format'
import { hasActiveFilters } from '../lib/query'

interface Props {
  filters: PopulationFilters
  options?: FilterOptions
  onChange: (changes: Partial<Record<keyof PopulationFilters, string | undefined>>) => void
  /** Free-text search applies to the directory only; insights aggregate whole populations. */
  showSearch?: boolean
}

const SEARCH_DEBOUNCE_MS = 300

/** Population filters shared by the overview and the directory, kept in the URL by the parent. */
export default function FilterBar({ filters, options, onChange, showSearch = false }: Props) {
  const [search, setSearch] = useState(filters.search ?? '')
  const [syncedSearch, setSyncedSearch] = useState(filters.search)

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear filters", back button).
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search)
    setSearch(filters.search ?? '')
  }

  useEffect(() => {
    if ((filters.search ?? '') === search) return undefined
    const timer = window.setTimeout(() => onChange({ search: search.trim() || undefined }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search, filters.search, onChange])

  const select = (key: keyof PopulationFilters, placeholder: string, values: string[] = [], width = 170) => (
    <Select
      aria-label={`Filter by ${placeholder.toLowerCase()}`}
      allowClear
      showSearch
      placeholder={placeholder}
      value={filters[key]}
      onChange={(value?: string) => onChange({ [key]: value })}
      options={values.map((value) => ({
        value,
        label: key === 'country' ? `${countryFlag(value)} ${value}` : value,
      }))}
      style={{ width }}
    />
  )

  const active = hasActiveFilters(showSearch ? filters : { ...filters, search: undefined })

  return (
    <Flex wrap gap={8} align="center" style={{ marginBottom: 16 }}>
      {showSearch && (
        <Input
          aria-label="Search employees"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search name, email or employee ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 280 }}
        />
      )}
      {select('country', 'Country', options?.countries)}
      {select('department', 'Department', options?.departments)}
      {select('job_title', 'Designation', options?.job_titles, 210)}
      {select('employment_status', 'Status', options?.employment_statuses, 130)}
      {active && (
        <Button
          icon={<ClearOutlined />}
          type="link"
          onClick={() =>
            onChange({ search: undefined, country: undefined, department: undefined, job_title: undefined, employment_status: undefined })
          }
        >
          Clear filters
        </Button>
      )}
    </Flex>
  )
}
