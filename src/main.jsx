import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import EmployeePanel from './components/EmployeePanel';
import EmployeeTable from './components/EmployeeTable';
import QuestionPanel from './components/QuestionPanel';
import { addSalaryRecord, getEmployee, getEmployees, getOptions, getSalaryHistory, getSummary } from './lib/api';
import './styles.css';

const PAGE_SIZE = 25;
const EMPTY_FILTERS = { country: '', department: '', job_title: '', employment_status: '' };

function App() {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ countries: [], departments: [], job_titles: [], employment_statuses: [] });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('name');
  const [direction, setDirection] = useState('asc');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [panelError, setPanelError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);

  const directoryQuery = useMemo(() => {
    const query = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort, direction });
    if (search.trim()) query.set('search', search.trim());
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    return query.toString();
  }, [search, filters, page, sort, direction]);

  const reportQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (search.trim()) query.set('search', search.trim());
    Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
    return query.toString();
  }, [search, filters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setSummaryLoading(true);
    setListError('');
    try {
      const [directory, report] = await Promise.all([
        getEmployees(directoryQuery),
        getSummary(reportQuery),
      ]);
      setEmployees(directory.items);
      setTotal(directory.total);
      setSummary(report);
    } catch (error) {
      setListError(error.message);
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [directoryQuery, reportQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getOptions().then(setOptions).catch((error) => setListError(error.message));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [search, filters]);

  useEffect(() => {
    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function openEmployee(employee) {
    setPanelError('');
    setSelectedEmployee(employee);
    try {
      const [details, history] = await Promise.all([
        getEmployee(employee.id),
        getSalaryHistory(employee.id),
      ]);
      setSelectedEmployee(details);
      setSalaryHistory(history.items);
    } catch (error) {
      setPanelError(error.message);
    }
  }

  async function saveSalaryRecord(record) {
    if (!selectedEmployee) return;
    setSaving(true);
    setPanelError('');
    try {
      const result = await addSalaryRecord(selectedEmployee.id, record);
      const [details, history] = await Promise.all([
        getEmployee(selectedEmployee.id),
        getSalaryHistory(selectedEmployee.id),
      ]);
      setSelectedEmployee(details);
      setSalaryHistory(history.items);
      setNotice(result.status === 'scheduled'
        ? `Salary change scheduled for ${result.effective_date}`
        : 'Salary record saved');
      await loadData();
    } catch (error) {
      setPanelError(error.message);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function updateSort(name) {
    if (sort === name) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSort(name);
      setDirection('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setFilters(EMPTY_FILTERS);
  }

  const hasActiveFilters = Boolean(search.trim() || Object.values(filters).some(Boolean));
  const currencies = useMemo(
    () => summary?.salary_by_currency.map((row) => row.currency) || [],
    [summary],
  );

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="ACME home">
        <span className="brand-mark">a</span><span>acme<span className="brand-dot">.</span></span>
      </a>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <a className="nav-item" href="#overview"><LayoutDashboard size={17} /> Overview</a>
        <a className="nav-item active" href="#directory"><Users size={17} /> People <span className="nav-count">10k</span></a>
        <a className="nav-item" href="#compensation"><Wallet size={17} /> Compensation</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card">
          <CircleHelp size={18} className="help-icon" />
          <strong>Salary records</strong>
          <span>Changes are saved with an effective date and reason.</span>
          <a href="#directory">Open directory <ChevronRight size={14} /></a>
        </div>
        <div className="profile">
          <div className="avatar profile-avatar">MK</div>
          <div><strong>Monin Kumar</strong><span>HR Manager</span></div>
          <MoreHorizontal size={18} className="profile-more" />
        </div>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div className="breadcrumb">People <ChevronRight size={14} /><strong>Compensation</strong></div>
        <div className="top-actions"><span className="secure-tag"><span /> Synthetic demo data</span><span className="top-avatar">MK</span></div>
      </header>
      <div className="content-wrap">
        <section className="page-heading" id="overview">
          <div>
            <div className="eyebrow"><span className="eyebrow-icon"><Wallet size={14} /></span> PEOPLE OPERATIONS</div>
            <h1>Compensation</h1>
            <p>Understand how ACME pays across its countries, departments, and currencies.</p>
          </div>
        </section>

        <QuestionPanel />
        <Dashboard summary={summary} loading={summaryLoading} />

        <section className="directory-card" id="directory">
          <div className="directory-heading">
            <div><h2>Employee directory</h2><p>Search and manage employee compensation records.</p></div>
            <button className="filter-button" onClick={clearFilters}><SlidersHorizontal size={15} /> Clear filters</button>
          </div>
          <div className="toolbar">
            <label className="search-box">
              <Search size={17} />
              <input ref={searchRef} aria-label="Search employees" placeholder="Search by name or employee ID…"
                value={search} onChange={(event) => setSearch(event.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <div className="filter-controls">
              <FilterSelect label="Country" value={filters.country} options={options.countries}
                onChange={(value) => updateFilter('country', value)} />
              <FilterSelect label="Department" value={filters.department} options={options.departments}
                onChange={(value) => updateFilter('department', value)} />
              <FilterSelect label="Designation" value={filters.job_title} options={options.job_titles}
                onChange={(value) => updateFilter('job_title', value)} />
              <FilterSelect label="Status" value={filters.employment_status} options={options.employment_statuses}
                onChange={(value) => updateFilter('employment_status', value)} />
            </div>
          </div>
          {hasActiveFilters && <div className="active-filter-note">
            Showing the selected employee population. <button onClick={clearFilters}>Clear all</button>
          </div>}
          <EmployeeTable
            employees={employees} total={total} page={page} pageSize={PAGE_SIZE} loading={loading}
            error={listError} sort={sort} direction={direction} onOpen={openEmployee} onRetry={loadData}
            onSort={updateSort} onPageChange={setPage}
          />
        </section>
        <p className="privacy-note"><span className="note-dot" /> All seeded employee records are fictional. Salary changes are versioned by effective date.</p>
      </div>
    </main>

    {selectedEmployee && <EmployeePanel
      employee={selectedEmployee} history={salaryHistory} currencies={currencies}
      error={panelError} saving={saving} onClose={() => setSelectedEmployee(null)} onSave={saveSalaryRecord}
    />}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>;
}

function FilterSelect({ label, value, options, onChange }) {
  return <label><span className="sr-only">Filter by {label.toLowerCase()}</span>
    <select aria-label={`Filter by ${label.toLowerCase()}`} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{label}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>;
}

createRoot(document.getElementById('root')).render(<App />);
