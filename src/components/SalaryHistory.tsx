import { Empty, Tag, Timeline, Typography } from 'antd'

import type { Employee, SalaryRecord } from '../api/types'
import { changeRatio, formatDate, formatMoney, formatPct } from '../lib/format'
import { type RecordStatus, recordStatus } from '../lib/insights'

const STATUS_COLOR: Record<RecordStatus, string> = { Scheduled: 'gold', Current: 'green', Historical: 'default' }

/** Newest-first audit trail of salary records, including scheduled future changes. */
export default function SalaryHistory({ employee, records }: { employee: Employee; records: SalaryRecord[] }) {
  if (records.length === 0) return <Empty description="No salary records yet" />
  const today = new Date().toISOString().slice(0, 10)
  return (
    <Timeline
      items={records.map((record) => {
        const status = recordStatus(record, employee, today)
        const ratio = changeRatio(record.previous_salary_minor, record.new_salary_minor, record.previous_currency === record.currency)
        return {
          key: record.id,
          color: status === 'Scheduled' ? 'gold' : status === 'Current' ? 'green' : 'gray',
          content: (
            <div>
              <Typography.Text strong className="tabular">
                {formatMoney(record.new_salary_minor, record.currency)}
              </Typography.Text>{' '}
              <Tag color={STATUS_COLOR[status]}>{status}</Tag>
              {ratio !== null && <Tag color={ratio >= 0 ? 'green' : 'red'}>{formatPct(ratio)}</Tag>}
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Effective {formatDate(record.effective_date)} · {record.reason} · by {record.changed_by}
                </Typography.Text>
              </div>
              {record.previous_salary_minor !== null && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Previously {formatMoney(record.previous_salary_minor, record.previous_currency)}
                </Typography.Text>
              )}
            </div>
          ),
        }
      })}
    />
  )
}
