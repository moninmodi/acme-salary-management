import React, { useEffect, useState } from 'react';
import { FileClock, X } from 'lucide-react';
import { formatDate, formatMoney, fullName, initials, salaryToMinorUnits } from '../lib/format';

function recordStatus(record, employee, today) {
  if (record.effective_date > today) return 'Scheduled';
  return record.effective_date === employee.salary_effective_date ? 'Current' : 'Historical';
}

export default function EmployeePanel({
  employee, history, currencies, error, saving, onClose, onSave,
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setSalaryAmount(employee.salary_minor == null ? '' : String(employee.salary_minor / 100));
    setCurrency(employee.currency || currencies[0] || 'USD');
    setEffectiveDate(today);
    setReason('');
    setFormError('');
  }, [employee.id, employee.salary_minor, employee.currency, currencies, today]);

  async function submit(event) {
    event.preventDefault();
    setFormError('');
    try {
      const salaryMinor = salaryToMinorUnits(salaryAmount);
      if (reason.trim().length < 3) throw new Error('Add a reason of at least 3 characters.');
      if (!effectiveDate || effectiveDate < today) throw new Error('Choose today or a future effective date.');
      await onSave({ salary_minor: salaryMinor, currency, effective_date: effectiveDate, reason: reason.trim() });
    } catch (submitError) {
      setFormError(submitError.message);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className="employee-panel" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <div className="panel-top"><span>EMPLOYEE COMPENSATION</span><button aria-label="Close" className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <div className="panel-identity">
        <div className="avatar lavender large-avatar">{initials(employee)}</div>
        <div><h2 id="panel-title">{fullName(employee)}</h2><span>{employee.employee_code} · {employee.job_title}</span></div>
      </div>
      <div className="profile-details">
        <div><span>Department</span><strong>{employee.department}</strong></div>
        <div><span>Location</span><strong>{employee.country}</strong></div>
        <div><span>Employment status</span><strong>{employee.employment_status}</strong></div>
        <div className="profile-email"><span>Email</span><strong>{employee.email}</strong></div>
      </div>

      <div className="panel-divider" />
      <form onSubmit={submit}>
        <h3>Create salary record</h3>
        <p className="panel-copy">Current salary <strong>{formatMoney(employee.salary_minor, employee.currency)}</strong>
          {employee.salary_effective_date && <> · effective {formatDate(employee.salary_effective_date)}</>}</p>
        <label className="field-label" htmlFor="salary-input">Annual salary</label>
        <div className="salary-input-wrap">
          <input id="salary-input" aria-label="New annual salary" inputMode="decimal" type="number" min="0" step="0.01"
            value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} required />
          <select aria-label="Salary currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </div>
        <label className="field-label" htmlFor="effective-date">Effective date</label>
        <input className="date-input" id="effective-date" type="date" min={today} value={effectiveDate}
          onChange={(event) => setEffectiveDate(event.target.value)} required />
        <label className="field-label" htmlFor="reason-input">Reason for change</label>
        <textarea id="reason-input" rows="3" maxLength="500" placeholder="e.g. Annual performance review"
          value={reason} onChange={(event) => setReason(event.target.value)} required />
        {(formError || error) && <div className="form-error" role="alert">{formError || error}</div>}
        <button className="save-button" disabled={saving}>{saving ? 'Saving salary record…' : 'Save salary record'}</button>
      </form>

      <div className="panel-divider" />
      <div className="history-heading">
        <div><h3>Salary history</h3><span>Current, past, and scheduled records</span></div><FileClock size={18} />
      </div>
      <div className="history-list">
        {history.length ? history.map((record) => <div className="history-item" key={record.id}>
          <div className="history-line"><strong>{formatMoney(record.new_salary_minor, record.currency)}</strong>
            <time>{formatDate(record.effective_date)}</time></div>
          <span className={`record-status ${recordStatus(record, employee, today).toLowerCase()}`}>
            {recordStatus(record, employee, today)}
          </span>
          {record.previous_salary_minor != null && <p>
            {formatMoney(record.previous_salary_minor, record.previous_currency)} → {formatMoney(record.new_salary_minor, record.currency)}
          </p>}
          <span className="history-reason">{record.reason}</span>
          <span className="history-author">Recorded by {record.changed_by}</span>
        </div>) : <div className="empty-history">No salary records have been recorded yet.</div>}
      </div>
    </aside>
  </div>;
}
