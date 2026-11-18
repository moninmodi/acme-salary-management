import { Card, Table, Tag, Typography } from 'antd'

import { useOutliers } from '../api/hooks'
import type { PopulationFilters } from '../api/types'
import { formatCount, formatMoney } from '../lib/format'

/** Aggregate 1.5×IQR outlier counts per currency for the filtered population. */
export default function OutlierCard({ filters }: { filters: PopulationFilters }) {
  const { data, isLoading } = useOutliers(filters)
  return (
    <Card
      title="Unusual salaries"
      extra={<Typography.Text type="secondary">Outside 1.5 × interquartile range, per currency</Typography.Text>}
      loading={isLoading}
      style={{ marginTop: 16 }}
    >
      <Table
        size="small"
        rowKey="currency"
        pagination={false}
        dataSource={data?.results ?? []}
        scroll={{ x: true }}
        columns={[
          { title: 'Currency', dataIndex: 'currency', key: 'c', render: (c: string) => <Tag>{c}</Tag> },
          { title: 'Employees', dataIndex: 'employee_count', key: 'n', align: 'right', render: formatCount },
          {
            title: 'Unusually low below',
            key: 'low',
            align: 'right',
            // A negative fence means no salary can be a low outlier.
            render: (_, r) => (r.lower_fence_minor > 0 ? formatMoney(r.lower_fence_minor, r.currency) : '—'),
          },
          {
            title: 'Unusually high above',
            key: 'high',
            align: 'right',
            render: (_, r) => formatMoney(r.upper_fence_minor, r.currency),
          },
          { title: 'Low outliers', dataIndex: 'lower_outlier_count', key: 'below', align: 'right', render: formatCount },
          { title: 'High outliers', dataIndex: 'upper_outlier_count', key: 'above', align: 'right', render: formatCount },
          {
            title: 'Share of employees',
            key: 'share',
            align: 'right',
            render: (_, r) => (r.employee_count ? `${((r.outlier_count / r.employee_count) * 100).toFixed(1)}%` : '—'),
          },
        ]}
      />
    </Card>
  )
}
