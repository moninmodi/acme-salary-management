import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Flex, Input, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'

import { useAskQuestion, useFeatures } from '../api/hooks'
import type { QuestionResponse, QuestionResultRow } from '../api/types'
import { formatCount, formatMoney, humanize } from '../lib/format'
import { EXAMPLE_QUESTIONS } from '../lib/insights'

const TOOL_LABELS: Record<QuestionResponse['tool_name'], string> = {
  get_summary: 'Salary summary',
  get_breakdown: 'Salary breakdown',
  get_outliers: 'Outlier check (1.5×IQR)',
}

function resultColumns(response: QuestionResponse): ColumnsType<QuestionResultRow> {
  const money = (key: keyof QuestionResultRow) => (_: unknown, row: QuestionResultRow) =>
    formatMoney(row[key] as number | undefined, row.currency)
  const columns: ColumnsType<QuestionResultRow> = []
  if (response.group_by && response.group_by !== 'currency') {
    columns.push({ title: humanize(response.group_by), dataIndex: 'group', key: 'group' })
  }
  columns.push(
    { title: 'Currency', dataIndex: 'currency', key: 'currency', render: (c: string) => <Tag>{c}</Tag> },
    { title: 'Employees', dataIndex: 'employee_count', key: 'n', align: 'right', render: (n?: number) => (n === undefined ? '—' : formatCount(n)) },
  )
  if (response.tool_name === 'get_outliers') {
    columns.push(
      { title: 'Normal range', key: 'range', render: (_, r) => `${money('lower_fence_minor')(_, r)} – ${money('upper_fence_minor')(_, r)}` },
      { title: 'Below', dataIndex: 'lower_outlier_count', key: 'below', align: 'right' },
      { title: 'Above', dataIndex: 'upper_outlier_count', key: 'above', align: 'right' },
    )
  } else {
    columns.push(
      { title: 'Median', key: 'median', align: 'right', render: money('median_minor') },
      { title: 'Average', key: 'average', align: 'right', render: money('average_minor') },
      { title: 'Range', key: 'range', align: 'right', render: (_, r) => `${money('min_minor')(_, r)} – ${money('max_minor')(_, r)}` },
    )
  }
  return columns
}

/**
 * Natural-language questions answered by Gemini function calling. Gemini only chooses an
 * allowlisted insight; the numbers shown come from the backend, so HR can verify every answer.
 */
export default function AskPanel() {
  const [question, setQuestion] = useState('')
  const features = useFeatures()
  const ask = useAskQuestion()
  const enabled = features.data?.natural_language_questions ?? false

  const submit = (text = question) => {
    const trimmed = text.trim()
    if (trimmed.length < 3) return
    setQuestion(trimmed)
    ask.mutate(trimmed)
  }

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          Ask about compensation
        </Space>
      }
      extra={<Tag color={enabled ? 'blue' : 'default'}>{enabled ? 'Gemini · verified data' : 'Optional AI feature'}</Tag>}
      style={{ marginBottom: 16 }}
    >
      {features.isSuccess && !enabled && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Question answering is turned off"
          description="Set GEMINI_API_KEY in .env and restart the API to enable it. Everything else works without it."
        />
      )}
      <Space.Compact style={{ width: '100%' }}>
        <Input
          aria-label="Your question"
          placeholder="e.g. What is the median salary by department in India?"
          maxLength={300}
          value={question}
          disabled={!enabled}
          onChange={(event) => setQuestion(event.target.value)}
          onPressEnter={() => submit()}
        />
        <Button type="primary" icon={<SendOutlined />} loading={ask.isPending} disabled={!enabled} onClick={() => submit()}>
          Ask
        </Button>
      </Space.Compact>
      {enabled && (
        <Flex wrap gap={6} style={{ marginTop: 10 }}>
          <Typography.Text type="secondary">Try:</Typography.Text>
          {EXAMPLE_QUESTIONS.map((example) => (
            <Tag key={example} style={{ cursor: 'pointer' }} onClick={() => submit(example)}>
              {example}
            </Tag>
          ))}
        </Flex>
      )}
      {ask.isError && <Alert type="error" showIcon style={{ marginTop: 12 }} title={ask.error.message} />}
      {ask.data && <Answer response={ask.data} />}
    </Card>
  )
}

function Answer({ response }: { response: QuestionResponse }) {
  return (
    <div style={{ marginTop: 16 }} aria-live="polite">
      <Typography.Paragraph style={{ fontSize: 15 }} strong>
        {response.answer}
      </Typography.Paragraph>
      <Flex wrap gap={6} style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">How this was answered:</Typography.Text>
        <Tag color="geekblue">{TOOL_LABELS[response.tool_name]}</Tag>
        {response.group_by && <Tag>by {humanize(response.group_by)}</Tag>}
        {Object.entries(response.filters).map(([key, value]) => (
          <Tag key={key} color="purple">
            {humanize(key)}: {value}
          </Tag>
        ))}
        {response.total_employees !== null && (
          <Tag>{formatCount(response.total_employees)} employees in population</Tag>
        )}
      </Flex>
      <Table
        size="small"
        rowKey={(row) => `${row.group ?? ''}-${row.currency}`}
        columns={resultColumns(response)}
        dataSource={response.results}
        pagination={response.results.length > 8 ? { pageSize: 8, size: 'small' } : false}
        scroll={{ x: true }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Figures are computed by the backend from the live data; salaries stay separated by currency.
      </Typography.Text>
    </div>
  )
}
