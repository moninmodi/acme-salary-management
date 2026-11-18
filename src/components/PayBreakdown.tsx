import { Card, Empty, Flex, Segmented, Select, Table, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useBreakdown } from '../api/hooks'
import type { BreakdownDimension, BreakdownRow, PopulationFilters } from '../api/types'
import { formatCount, formatMoney } from '../lib/format'
import { defaultCurrency } from '../lib/insights'
import { CHART_COLORS } from '../theme'

const DIMENSIONS: { label: string; value: BreakdownDimension }[] = [
  { label: 'Department', value: 'department' },
  { label: 'Designation', value: 'designation' },
  { label: 'Country', value: 'country' },
  { label: 'Status', value: 'employment_status' },
]

/**
 * "How do we pay people?": median, average and range per group. Salaries are only comparable
 * within one currency, so the chart shows one currency at a time.
 */
export default function PayBreakdown({ filters }: { filters: PopulationFilters }) {
  const [by, setBy] = useState<BreakdownDimension>('department')
  const [chosenCurrency, setChosenCurrency] = useState<string>()
  const { data, isLoading } = useBreakdown(by, filters)

  const rows = useMemo(() => data?.results ?? [], [data])
  const currencies = useMemo(() => [...new Set(rows.map((row) => row.currency))].sort(), [rows])
  const currency = chosenCurrency && currencies.includes(chosenCurrency) ? chosenCurrency : defaultCurrency(rows)
  const visible = useMemo(
    () => rows.filter((row) => row.currency === currency).sort((a, b) => b.median_minor - a.median_minor),
    [rows, currency],
  )

  return (
    <Card
      title="Pay by group"
      extra={
        <Flex gap={8} wrap>
          <Segmented options={DIMENSIONS} value={by} onChange={(value) => setBy(value as BreakdownDimension)} />
          <Select
            aria-label="Currency"
            value={currency}
            onChange={setChosenCurrency}
            options={currencies.map((c) => ({ value: c, label: c }))}
            style={{ width: 90 }}
          />
        </Flex>
      }
      loading={isLoading}
      style={{ marginBottom: 16 }}
    >
      {visible.length === 0 ? (
        <Empty description="No salaries in this view" />
      ) : (
        <>
          <Typography.Text type="secondary">Median annual salary in {currency}, highest first</Typography.Text>
          <ResponsiveContainer width="100%" height={Math.max(160, visible.length * 30 + 40)}>
            <BarChart data={visible} layout="vertical" margin={{ left: 24, right: 24, top: 8 }}>
              <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
              <XAxis type="number" tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
              <YAxis type="category" dataKey="group" width={170} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => formatMoney(Number(value), currency)}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="median_minor" name="Median" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Table<BreakdownRow>
            size="small"
            rowKey={(row) => `${row.group}-${row.currency}`}
            dataSource={visible}
            pagination={false}
            scroll={{ x: true }}
            columns={[
              { title: DIMENSIONS.find((d) => d.value === by)?.label, dataIndex: 'group', key: 'group' },
              { title: 'Employees', dataIndex: 'employee_count', key: 'n', align: 'right', render: formatCount },
              { title: 'Median', dataIndex: 'median_minor', key: 'median', align: 'right', render: (v: number) => formatMoney(v, currency) },
              { title: 'Average', dataIndex: 'average_minor', key: 'avg', align: 'right', render: (v: number) => formatMoney(v, currency) },
              { title: 'Min', dataIndex: 'min_minor', key: 'min', align: 'right', render: (v: number) => formatMoney(v, currency) },
              { title: 'Max', dataIndex: 'max_minor', key: 'max', align: 'right', render: (v: number) => formatMoney(v, currency) },
              { title: 'Annual payroll', dataIndex: 'payroll_minor', key: 'payroll', align: 'right', render: (v: number) => formatMoney(v, currency, { compact: true }) },
            ]}
          />
        </>
      )}
    </Card>
  )
}
