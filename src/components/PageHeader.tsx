import { Flex, Typography } from 'antd'
import type { ReactNode } from 'react'

/** Page title with an optional subtitle and right-aligned actions. */
export default function PageHeader({ title, subtitle, extra }: { title: string; subtitle?: ReactNode; extra?: ReactNode }) {
  return (
    <Flex justify="space-between" align="flex-end" wrap gap={12} style={{ marginBottom: 20 }}>
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra}
    </Flex>
  )
}
