import { Alert, Avatar, Card, Descriptions, Divider, Drawer, Flex, Skeleton, Statistic, Tag, Typography } from 'antd'

import { useEmployee, useFilterOptions, useSalaryHistory } from '../api/hooks'
import { countryFlag, formatDate, formatMoney, fullName, initials } from '../lib/format'
import SalaryHistory from './SalaryHistory'
import SalaryRecordForm from './SalaryRecordForm'

/** Employee profile, current pay, new salary record form and full salary history. */
export default function EmployeeDrawer({ employeeId, onClose }: { employeeId: number | null; onClose: () => void }) {
  const employee = useEmployee(employeeId)
  const history = useSalaryHistory(employeeId)
  const options = useFilterOptions()
  const e = employee.data

  return (
    <Drawer open={employeeId !== null} onClose={onClose} size={560} destroyOnHidden title="Employee compensation">
      {employee.isError && <Alert type="error" showIcon title={employee.error.message} />}
      {!e && employee.isLoading && <Skeleton active />}
      {e && (
        <>
          <Flex gap={12} align="center" style={{ marginBottom: 16 }}>
            <Avatar size={48} style={{ background: '#2f54eb' }}>
              {initials(e)}
            </Avatar>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {fullName(e)}
              </Typography.Title>
              <Typography.Text type="secondary">
                {e.employee_code} · {e.job_title}
              </Typography.Text>
            </div>
            <Tag color={e.employment_status === 'Active' ? 'green' : 'default'} style={{ marginLeft: 'auto' }}>
              {e.employment_status}
            </Tag>
          </Flex>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Department">{e.department}</Descriptions.Item>
            <Descriptions.Item label="Country">
              {countryFlag(e.country)} {e.country}
            </Descriptions.Item>
            <Descriptions.Item label="Email" span={2}>
              {e.email}
            </Descriptions.Item>
          </Descriptions>
          <Card size="small" style={{ marginTop: 16 }}>
            <Statistic
              title={`Current annual salary${e.salary_effective_date ? ` · effective ${formatDate(e.salary_effective_date)}` : ''}`}
              value={formatMoney(e.salary_minor, e.currency)}
            />
          </Card>
          <Divider titlePlacement="start">New salary record</Divider>
          <SalaryRecordForm employee={e} currencies={options.data?.currencies ?? (e.currency ? [e.currency] : [])} />
          <Divider titlePlacement="start">Salary history</Divider>
          {history.isLoading ? <Skeleton active /> : <SalaryHistory employee={e} records={history.data?.items ?? []} />}
        </>
      )}
    </Drawer>
  )
}
