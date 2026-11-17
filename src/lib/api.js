const API_ROOT = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.detail || 'The service could not complete this request.');
  }
  return body;
}

export function getOptions() {
  return request('/options');
}

export function getFeatures() {
  return request('/features');
}

export function getEmployees(query) {
  return request(`/employees?${query}`);
}

export function getSummary(query) {
  return request(`/summary?${query}`);
}

export function getEmployee(employeeId) {
  return request(`/employees/${employeeId}`);
}

export function getSalaryHistory(employeeId) {
  return request(`/employees/${employeeId}/history`);
}

export function addSalaryRecord(employeeId, record) {
  return request(`/employees/${employeeId}/salaries`, {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

export function askQuestion(question) {
  return request('/questions', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
