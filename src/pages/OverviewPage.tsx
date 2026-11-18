import { Col, Row } from 'antd'

import { useFilterOptions, useSummary } from '../api/hooks'
import AskPanel from '../components/AskPanel'
import FilterBar from '../components/FilterBar'
import OutlierCard from '../components/OutlierCard'
import PageHeader from '../components/PageHeader'
import PayBreakdown from '../components/PayBreakdown'
import { CurrencyTable, DistributionCard, KpiRow } from '../components/SummaryCards'
import { useUrlFilters } from '../lib/useUrlState'

/** Answers "how does ACME pay people?" for any filtered population. */
export default function OverviewPage() {
  const { filters, update } = useUrlFilters()
  const insightFilters = { ...filters, search: undefined }
  const options = useFilterOptions()
  const summary = useSummary(insightFilters)

  return (
    <>
      <PageHeader
        title="Pay overview"
        subtitle="How ACME pays across countries, departments and designations. Click a country or department to drill in."
      />
      <AskPanel />
      <FilterBar filters={insightFilters} options={options.data} onChange={update} />
      <KpiRow summary={summary.data} />
      <PayBreakdown filters={insightFilters} />
      <CurrencyTable summary={summary.data} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <DistributionCard
            title="Employees by country"
            items={summary.data?.by_country.map((r) => ({ label: r.country, count: r.employee_count }))}
            onSelect={(country) => update({ country })}
          />
        </Col>
        <Col xs={24} lg={12}>
          <DistributionCard
            title="Employees by department"
            items={summary.data?.by_department.map((r) => ({ label: r.department, count: r.employee_count }))}
            onSelect={(department) => update({ department })}
          />
        </Col>
      </Row>
      <OutlierCard filters={insightFilters} />
    </>
  )
}
