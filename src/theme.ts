import type { ThemeConfig } from 'antd'

export const BRAND = '#2f54eb'

export const theme: ThemeConfig = {
  token: {
    colorPrimary: BRAND,
    borderRadius: 8,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    colorBgLayout: '#f5f6f8',
  },
  components: {
    Layout: { siderBg: '#121826', headerBg: '#ffffff' },
    Menu: { darkItemBg: '#121826', darkItemSelectedBg: BRAND },
    Table: { headerBg: '#fafbfc' },
  },
}

export const CHART_COLORS = { primary: BRAND, range: '#adc6ff', grid: '#eef0f4' }
