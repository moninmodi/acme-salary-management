import { Alert, App, Button, DatePicker, Form, Input, Select, Space, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect } from 'react'

import { useAddSalaryRecord } from '../api/hooks'
import type { Employee } from '../api/types'
import { changeRatio, formatDate, formatMoney, formatPct, minorUnitsToInput, salaryToMinorUnits } from '../lib/format'

interface FormValues {
  amount: string
  currency: string
  effectiveDate: Dayjs
  reason: string
}

const LARGE_CHANGE = 0.25

/** Parse the amount field leniently for the live preview; the validator reports bad input. */
function previewMinor(amount: string | undefined): number | null {
  try {
    return amount ? salaryToMinorUnits(amount) : null
  } catch {
    return null
  }
}

/**
 * Append an effective-dated salary record. Records dated today become current immediately;
 * future dates are scheduled. History is never overwritten.
 */
export default function SalaryRecordForm({ employee, currencies }: { employee: Employee; currencies: string[] }) {
  const [form] = Form.useForm<FormValues>()
  const { message } = App.useApp()
  const save = useAddSalaryRecord(employee.id)
  const amount = Form.useWatch('amount', form)
  const currency = Form.useWatch('currency', form)

  // Clear a previous employee's save state when another employee is opened. This must not run
  // when the current salary changes: that happens *during* a successful save (queries are
  // refetched) and resetting then would drop the mutation's onSuccess callback.
  const { reset: resetSave } = save
  useEffect(() => resetSave(), [employee.id, resetSave])

  // Pre-fill with the current salary whenever it (or the employee) changes.
  useEffect(() => {
    form.setFieldsValue({
      amount: minorUnitsToInput(employee.salary_minor),
      currency: employee.currency ?? currencies[0],
      effectiveDate: dayjs(),
      reason: '',
    })
    // currencies is reference data; re-filling the form when it loads would wipe user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id, employee.salary_minor, employee.currency, form])

  const newMinor = previewMinor(amount)
  const ratio = newMinor === null ? null : changeRatio(employee.salary_minor, newMinor, currency === employee.currency)

  const onFinish = (values: FormValues) =>
    // Server-side rejections are shown inline via save.error, so no rejection escapes here.
    save.mutate(
      {
        salary_minor: salaryToMinorUnits(values.amount),
        currency: values.currency,
        effective_date: values.effectiveDate.format('YYYY-MM-DD'),
        reason: values.reason.trim(),
      },
      {
        onSuccess: (result) => {
          message.success(
            result.status === 'scheduled'
              ? `Salary change scheduled for ${formatDate(result.effective_date)}`
              : 'Salary record saved and now current',
          )
          form.setFieldValue('reason', '')
        },
      },
    )

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} aria-label="New salary record">
      <Space.Compact style={{ width: '100%' }}>
        <Form.Item
          name="amount"
          label="New annual salary"
          style={{ flex: 1, marginBottom: 8 }}
          rules={[
            { required: true, message: 'Enter the new annual salary' },
            {
              validator: async (_, value: string) => {
                if (value) salaryToMinorUnits(value) // throws a user-facing message
              },
            },
          ]}
        >
          <Input inputMode="decimal" aria-label="New annual salary" />
        </Form.Item>
        <Form.Item name="currency" label="Currency" style={{ width: 110, marginBottom: 8 }} rules={[{ required: true }]}>
          <Select aria-label="Currency" options={currencies.map((c) => ({ value: c, label: c }))} />
        </Form.Item>
      </Space.Compact>
      <Typography.Text type={ratio !== null && Math.abs(ratio) >= LARGE_CHANGE ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
        {ratio === null
          ? currency && currency !== employee.currency
            ? `Currency change: ${employee.currency ?? '—'} → ${currency}`
            : ' '
          : `${formatPct(ratio)} vs current ${formatMoney(employee.salary_minor, employee.currency)}${
              Math.abs(ratio) >= LARGE_CHANGE ? ' · large change, please double-check' : ''
            }`}
      </Typography.Text>
      <Form.Item
        name="effectiveDate"
        label="Effective date"
        style={{ marginTop: 8 }}
        rules={[{ required: true, message: 'Choose an effective date' }]}
        extra="Today makes it current; a future date schedules it."
      >
        <DatePicker
          aria-label="Effective date"
          style={{ width: '100%' }}
          disabledDate={(day) => day.isBefore(dayjs(), 'day')}
          allowClear={false}
        />
      </Form.Item>
      <Form.Item
        name="reason"
        label="Reason for change"
        rules={[
          { required: true, message: 'A reason is required for the audit trail' },
          { min: 3, whitespace: true, message: 'Use at least 3 characters' },
        ]}
      >
        <Input.TextArea aria-label="Reason for change" rows={2} maxLength={500} showCount placeholder="e.g. Annual performance review" />
      </Form.Item>
      {save.isError && <Alert type="error" showIcon title={save.error.message} style={{ marginBottom: 12 }} />}
      <Button type="primary" htmlType="submit" loading={save.isPending} block>
        Save salary record
      </Button>
    </Form>
  )
}
