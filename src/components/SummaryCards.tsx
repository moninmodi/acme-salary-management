import { Card, Col, Empty, Progress, Row, Statistic, Table, Tag, Typography } from 'antd'

import type { DashboardSummary } from '../api/types'
import { countryFlag, formatCount, formatMoney } from '../lib/format'

/** Headline numbers for the filtered population. */
export function KpiRow({ summary }: { summary?: DashboardSummary }) {
  const items = [
    { title: 'Employees in view', value: summary?.total_employees },
    { title: 'Countries', value: summary?.by_country.length },
    { title: 'Departments', value: summary?.by_department.length },
    { title: 'Salary currencies', value: summary?.salary_by_currency.length },
  ]
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      {items.map((item) => (
        <Col xs={12} lg={6} key={item.title}>
          <Card loading={!summary}>
            <Statistic title={item.title} value={item.value ?? 0} formatter={(v) => formatCount(Number(v))} />
          </Card>
        </Col>
      ))}
    </Row>
  )
}

/** Payroll and salary statistics per currency; currencies are never summed together. */
export function CurrencyTable({ summary }: { summary?: DashboardSummary }) {
  return (
    <Card
      title="Compensation by currency"
      extra={<Typography.Text type="secondary">Annual base salary · not converted between currencies</Typography.Text>}
      loading={!summary}
      style={{ marginBottom: 16 }}
    >
      <Table
        size="small"
        rowKey="currency"
        pagination={false}
        scroll={{ x: true }}
        dataSource={summary?.salary_by_currency ?? []}
        locale={{ emptyText: <Empty description="No salaries in this view" /> }}
        columns={[
          { title: 'Currency', dataIndex: 'currency', key: 'currency', render: (c: string) => <Tag color="blue">{c}</Tag> },
          { title: 'Employees', dataIndex: 'employee_count', key: 'n', align: 'right', render: formatCount },
          { title: 'Annual payroll', key: 'payroll', align: 'right', render: (_, r) => formatMoney(r.payroll_minor, r.currency) },
          { title: 'Median', key: 'median', align: 'right', render: (_, r) => formatMoney(r.median_minor, r.currency) },
          { title: 'Average', key: 'avg', align: 'right', render: (_, r) => formatMoney(r.average_minor, r.currency) },
          { title: 'Minimum', key: 'min', align: 'right', render: (_, r) => formatMoney(r.min_minor, r.currency) },
          { title: 'Maximum', key: 'max', align: 'right', render: (_, r) => formatMoney(r.max_minor, r.currency) },
        ]}
      />
    </Card>
  )
}

/** Headcount share per category, as labelled progress bars. */
export function DistributionCard({
  title,
  items,
  onSelect,
}: {
  title: string
  items?: { label: string; count: number }[]
  onSelect?: (label: string) => void
}) {
  const total = items?.reduce((sum, item) => sum + item.count, 0) ?? 0
  const sorted = [...(items ?? [])].sort((a, b) => b.count - a.count)
  return (
    <Card title={title} loading={!items} style={{ height: '100%' }}>
      {sorted.length === 0 && <Empty description="No employees in this view" />}
      {sorted.map((item) => (
        <div
          key={item.label}
          style={{ marginBottom: 8, cursor: onSelect ? 'pointer' : undefined }}
          onClick={() => onSelect?.(item.label)}
        >
          <Row justify="space-between">
            <Typography.Text>
              {title.includes('country') ? `${countryFlag(item.label)} ` : ''}
              {item.label}
            </Typography.Text>
            <Typography.Text type="secondary" className="tabular">
              {formatCount(item.count)}
            </Typography.Text>
          </Row>
          <Progress percent={total ? (item.count / total) * 100 : 0} status="normal" showInfo={false} size="small" />
        </div>
      ))}
    </Card>
  )
}
