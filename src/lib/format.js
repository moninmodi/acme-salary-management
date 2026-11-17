export function formatMoney(minorUnits, currency) {
  if (minorUnits === null || minorUnits === undefined || !currency) return '—';
  return new Intl.NumberFormat('en', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Number(minorUnits) / 100);
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(`${dateString.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

export function fullName(employee) {
  return `${employee.first_name} ${employee.last_name}`;
}

export function initials(employee) {
  return `${employee.first_name[0]}${employee.last_name[0]}`.toUpperCase();
}

export function countryFlag(country) {
  return ({
    India: '🇮🇳', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
    Germany: '🇩🇪', Canada: '🇨🇦', Singapore: '🇸🇬',
  })[country] || '🌐';
}

export function salaryToMinorUnits(amount) {
  const normalized = amount.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter an amount with up to two decimal places.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 10 ** 15) {
    throw new Error('Enter a salary within the supported range.');
  }
  return result;
}
