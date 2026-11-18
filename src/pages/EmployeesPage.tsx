import { InfoCircleOutlined } from '@ant-design/icons'
import { Alert, Avatar, Button, Card, Flex, Table, Tag, Tooltip, Typography } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult, TableCurrentDataSource } from 'antd/es/table/interface'
import { useCallback, useMemo } from 'react'

import { useDirectory, useFilterOptions } from '../api/hooks'
import type { Employee, SortField } from '../api/types'
import EmployeeDrawer from '../components/EmployeeDrawer'
import FilterBar from '../components/FilterBar'
import PageHeader from '../components/PageHeader'
import { countryFlag, formatCount, formatDate, formatMoney, fullName, initials } from '../lib/format'
import { PAGE_SIZE, readDirectoryQuery } from '../lib/query'
import { useUrlFilters } from '../lib/useUrlState'

/** Server-side paginated, filterable and sortable employee directory with a detail drawer. */
export default function EmployeesPage() {
  const { params, filters, update } = useUrlFilters()
  const query = useMemo(() => readDirectoryQuery(params), [params])
  const directory = useDirectory(query)
  const options = useFilterOptions()
  const selectedId = Number(params.get('employee')) || null
  const page = query.offset / PAGE_SIZE + 1
  // Salaries in different currencies are not comparable; allow salary sorting once a country is chosen.
  const salarySortable = Boolean(filters.country)

  const sortOrder = (field: SortField) =>
    query.sort === field ? (query.direction === 'asc' ? ('ascend' as const) : ('descend' as const)) : null

  const columns: ColumnsType<Employee> = [
    {
      title: 'Employee',
      key: 'name',
      sorter: true,
      sortOrder: sortOrder('name'),
      render: (_, e) => (
        <Flex gap={10} align="center">
          <Avatar size="small" style={{ background: '#adc6ff', color: '#10239e' }}>
            {initials(e)}
          </Avatar>
          <div>
            <Typography.Text strong>{fullName(e)}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {e.employee_code} · {e.email}
              </Typography.Text>
            </div>
          </div>
        </Flex>
      ),
    },
    {
      title: 'Designation',
      key: 'department',
      sorter: true,
      sortOrder: sortOrder('department'),
      render: (_, e) => (
        <div>
          {e.job_title}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {e.department}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Country',
      key: 'country',
      sorter: true,
      sortOrder: sortOrder('country'),
      render: (_, e) => `${countryFlag(e.country)} ${e.country}`,
    },
    {
      title: 'Status',
      dataIndex: 'employment_status',
      key: 'status',
      render: (status: string) => <Tag color={status === 'Active' ? 'green' : 'default'}>{status}</Tag>,
    },
    {
      title: salarySortable ? (
        'Current salary'
      ) : (
        <Tooltip title="Choose a country to sort by salary: amounts are in different currencies.">
          Current salary <InfoCircleOutlined />
        </Tooltip>
      ),
      key: 'salary',
      align: 'right',
      sorter: salarySortable,
      sortOrder: salarySortable ? sortOrder('salary') : null,
      render: (_, e) => (
        <div className="tabular">
          {formatMoney(e.salary_minor, e.currency)}
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              since {formatDate(e.salary_effective_date)}
            </Typography.Text>
          </div>
        </div>
      ),
    },
  ]

  const onTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      _filters: unknown,
      sorter: SorterResult<Employee> | SorterResult<Employee>[],
      extra: TableCurrentDataSource<Employee>,
    ) => {
      const single = Array.isArray(sorter) ? sorter[0] : sorter
      const sort = single?.order ? (single.columnKey as SortField) : undefined
      const direction = single?.order === 'descend' ? 'desc' : undefined
      const page = extra.action === 'paginate' && pagination.current && pagination.current > 1 ? pagination.current : undefined
      // name/asc is the default, so it is left out of the URL.
      update({ page, sort: sort === 'name' && !direction ? undefined : sort, direction }, { resetPage: false })
    },
    [update],
  )

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={
          directory.data
            ? `${formatCount(directory.data.total)} employees match · salaries as of ${formatDate(directory.data.as_of)}`
            : 'Search and manage employee compensation records'
        }
      />
      <Card>
        <FilterBar filters={filters} options={options.data} onChange={update} showSearch />
        {directory.isError && (
          <Alert
            type="error"
            showIcon
            title={directory.error.message}
            action={<Button onClick={() => directory.refetch()}>Retry</Button>}
            style={{ marginBottom: 12 }}
          />
        )}
        <Table<Employee>
          rowKey="id"
          columns={columns}
          dataSource={directory.data?.items}
          loading={directory.isFetching}
          onChange={onTableChange}
          onRow={(record) => ({ onClick: () => update({ employee: record.id }, { resetPage: false }) })}
          rowClassName={() => 'clickable-row'}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: directory.data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (total, [from, to]) => `${formatCount(from)}–${formatCount(to)} of ${formatCount(total)}`,
          }}
        />
      </Card>
      <EmployeeDrawer employeeId={selectedId} onClose={() => update({ employee: undefined }, { resetPage: false })} />
    </>
  )
}
