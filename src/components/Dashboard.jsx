import React from 'react';
import { Globe2, Users, Wallet } from 'lucide-react';
import { formatMoney } from '../lib/format';

function DistributionCard({ title, items, labelKey, icon: Icon }) {
  const maximum = Math.max(1, ...items.map((item) => item.employee_count));
  return (
    <section className="distribution-card">
      <div className="distribution-heading">
        <span className="stat-icon globe-icon"><Icon size={16} /></span>
        <div><h3>{title}</h3><span>Employees in the current view</span></div>
      </div>
      {items.length ? <ul className="distribution-list">
        {items.map((item) => <li key={item[labelKey]}>
          <div className="distribution-row"><span>{item[labelKey]}</span><strong>{item.employee_count.toLocaleString()}</strong></div>
          <div className="distribution-track"><span style={{ width: `${item.employee_count / maximum * 100}%` }} /></div>
        </li>)}
      </ul> : <p className="distribution-empty">No employees in this view.</p>}
    </section>
  );
}

export default function Dashboard({ summary, loading }) {
  if (loading && !summary) return <div className="dashboard-loading">Loading compensation insights…</div>;
  if (!summary) return null;

  return (
    <section className="dashboard" id="compensation" aria-label="Employee and salary insights">
      <div className="stats-grid overview-stats">
        <div className="stat-card">
          <div className="stat-top"><span>Employees in view</span><span className="stat-icon people-icon"><Users size={16} /></span></div>
          <strong>{summary.total_employees.toLocaleString()}</strong>
          <div className="stat-foot">Across the selected population</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Countries</span><span className="stat-icon globe-icon"><Globe2 size={16} /></span></div>
          <strong>{summary.by_country.length}</strong>
          <div className="stat-foot">Represented in the selected view</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Departments</span><span className="stat-icon wallet-icon"><Wallet size={16} /></span></div>
          <strong>{summary.by_department.length}</strong>
          <div className="stat-foot">Represented in the selected view</div>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Salary currencies</span><span className="stat-icon wallet-icon"><Wallet size={16} /></span></div>
          <strong>{summary.salary_by_currency.length}</strong>
          <div className="currency-chips">{summary.salary_by_currency.map((row) => <span key={row.currency}>{row.currency}</span>)}</div>
        </div>
      </div>

      <div className="distribution-grid">
        <DistributionCard title="Employees by country" items={summary.by_country} labelKey="country" icon={Globe2} />
        <DistributionCard title="Employees by department" items={summary.by_department} labelKey="department" icon={Users} />
      </div>

      <section className="currency-summary">
        <div className="currency-summary-heading">
          <div><h3>Compensation by currency</h3><p>Payroll and salary statistics stay separated by currency.</p></div>
          <span className="stat-icon wallet-icon"><Wallet size={16} /></span>
        </div>
        {summary.salary_by_currency.length ? <div className="table-scroll"><table>
          <thead><tr><th>CURRENCY</th><th>EMPLOYEES</th><th>ANNUAL PAYROLL</th><th>AVERAGE</th><th>MINIMUM</th><th>MAXIMUM</th></tr></thead>
          <tbody>{summary.salary_by_currency.map((row) => <tr key={row.currency}>
            <td><span className="currency-code">{row.currency}</span></td>
            <td>{row.employee_count.toLocaleString()}</td>
            <td className="salary-cell">{formatMoney(row.payroll_minor, row.currency)}</td>
            <td>{formatMoney(row.average_minor, row.currency)}</td>
            <td>{formatMoney(row.min_minor, row.currency)}</td>
            <td>{formatMoney(row.max_minor, row.currency)}</td>
          </tr>)}</tbody>
        </table></div> : <div className="distribution-empty">No salary records in this view.</div>}
      </section>
    </section>
  );
}
