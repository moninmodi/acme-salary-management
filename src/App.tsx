import { DashboardOutlined, TeamOutlined } from '@ant-design/icons'
import { Avatar, Flex, Layout, Menu, Tag, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import EmployeesPage from './pages/EmployeesPage'
import OverviewPage from './pages/OverviewPage'

const NAV = [
  { key: '/overview', icon: <DashboardOutlined />, label: 'Pay overview' },
  { key: '/employees', icon: <TeamOutlined />, label: 'Employees' },
]

/** Application shell: navigation sidebar, header and the two routed pages. */
export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const selected = NAV.find((item) => location.pathname.startsWith(item.key))?.key ?? '/overview'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={220} breakpoint="lg" collapsedWidth={64}>
        <div style={{ padding: '20px 20px 16px' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: 18, letterSpacing: 0.4 }}>
            acme<span style={{ color: '#597ef7' }}>.</span>
          </Typography.Text>
          <Typography.Text style={{ color: '#8c93a8', display: 'block', fontSize: 12 }}>
            People &amp; Compensation
          </Typography.Text>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={NAV} onClick={({ key }) => navigate(key)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ paddingInline: 24, borderBottom: '1px solid #f0f0f0' }}>
          <Flex justify="flex-end" align="center" gap={12} style={{ height: '100%' }}>
            <Tag color="gold" variant="filled">
              Synthetic demo data
            </Tag>
            <Avatar style={{ background: '#2f54eb' }}>HR</Avatar>
            <Typography.Text>HR Manager</Typography.Text>
          </Flex>
        </Layout.Header>
        <Layout.Content style={{ padding: 24, maxWidth: 1440, width: '100%', margin: '0 auto' }}>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
