import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { countryFlag, formatMoney, fullName, initials } from '../lib/format';

const avatarColors = ['lavender', 'mint', 'peach', 'blue', 'yellow', 'rose'];

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown size={13} aria-hidden="true" />;
  return direction === 'asc'
    ? <ArrowUp size={13} aria-hidden="true" />
    : <ArrowDown size={13} aria-hidden="true" />;
}

function SortHeader({ sort, direction, onSort, children }) {
  return <button className="sort-header" onClick={onSort}>
    {children}<SortIcon active={sort} direction={direction} />
  </button>;
}

export default function EmployeeTable({
  employees, total, page, pageSize, loading, error, sort, direction,
  onOpen, onRetry, onSort, onPageChange,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? page * pageSize + 1 : 0;
  const last = Math.min((page + 1) * pageSize, total);

  return <>
    {error && <div className="error-banner" role="alert">{error}<button onClick={onRetry}>Retry</button></div>}
    <div className="table-scroll"><table>
      <thead><tr>
        <th><SortHeader sort={sort === 'name'} direction={direction} onSort={() => onSort('name')}>EMPLOYEE</SortHeader></th>
        <th><SortHeader sort={sort === 'department'} direction={direction} onSort={() => onSort('department')}>DEPARTMENT</SortHeader></th>
        <th>DESIGNATION</th>
        <th><SortHeader sort={sort === 'country'} direction={direction} onSort={() => onSort('country')}>LOCATION</SortHeader></th>
        <th><SortHeader sort={sort === 'salary'} direction={direction} onSort={() => onSort('salary')}>ANNUAL SALARY</SortHeader></th>
        <th>STATUS</th>
        <th aria-label="Actions" />
      </tr></thead>
      <tbody>
        {loading ? <tr><td colSpan="7" className="table-state"><span className="spinner" />Loading employee records…</td></tr>
          : employees.length === 0 ? <tr><td colSpan="7" className="table-state">No employees match these filters.</td></tr>
            : employees.map((employee, index) => <tr
              key={employee.id}
              onClick={() => onOpen(employee)}
              onKeyDown={(event) => event.key === 'Enter' && onOpen(employee)}
              tabIndex="0"
            >
              <td><div className="person-cell">
                <div className={`avatar ${avatarColors[index % avatarColors.length]}`}>{initials(employee)}</div>
                <div><strong>{fullName(employee)}</strong><span>{employee.employee_code} · {employee.email}</span></div>
              </div></td>
              <td><span className="department-label">{employee.department}</span></td>
              <td className="muted-cell">{employee.job_title}</td>
              <td><span className="location-cell"><span className="flag">{countryFlag(employee.country)}</span>{employee.country}</span></td>
              <td className="salary-cell">{formatMoney(employee.salary_minor, employee.currency)}</td>
              <td><span className={`status-pill ${employee.employment_status.toLowerCase()}`}>{employee.employment_status}</span></td>
              <td><button className="row-more" aria-label={`View ${fullName(employee)}`} onClick={(event) => {
                event.stopPropagation(); onOpen(employee);
              }}><MoreHorizontal size={17} /></button></td>
            </tr>)}
      </tbody>
    </table></div>
    <footer className="table-footer">
      <span>Showing <strong>{first}–{last}</strong> of <strong>{total.toLocaleString()}</strong> employees</span>
      <div className="pagination">
        <button aria-label="Previous page" disabled={page === 0 || loading} onClick={() => onPageChange(page - 1)}><ChevronLeft size={16} /></button>
        <span>Page {page + 1} of {pageCount}</span>
        <button aria-label="Next page" disabled={page + 1 >= pageCount || loading} onClick={() => onPageChange(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </footer>
  </>;
}
