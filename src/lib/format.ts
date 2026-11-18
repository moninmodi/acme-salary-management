// Display helpers. Money is stored as integer minor units (cents, paise) with an ISO currency code.

const moneyFormatters = new Map<string, Intl.NumberFormat>()

function moneyFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}|${compact}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter
}

/** "$120,000" from 12_000_000 minor units; compact "₹3.9M" for charts and KPIs; "—" when missing. */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: string | null | undefined,
  options: { compact?: boolean } = {},
): string {
  if (minorUnits === null || minorUnits === undefined || !currency || Number.isNaN(minorUnits)) return '—'
  return moneyFormatter(currency, options.compact ?? false).format(minorUnits / 100)
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })

/** "18 Nov 2026" style date from an ISO date or timestamp, interpreted in UTC. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

const integer = new Intl.NumberFormat('en')
export const formatCount = (n: number): string => integer.format(n)

/** Relative change between two amounts in the same currency, or null when not comparable. */
export function changeRatio(
  previous: number | null | undefined,
  next: number,
  sameCurrency = true,
): number | null {
  if (!previous || !sameCurrency) return null
  return (next - previous) / previous
}

export function formatPct(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return '—'
  const sign = ratio > 0 ? '+' : ''
  return `${sign}${(ratio * 100).toFixed(1)}%`
}

export const fullName = (e: { first_name: string; last_name: string }): string => `${e.first_name} ${e.last_name}`

export const initials = (e: { first_name: string; last_name: string }): string =>
  `${e.first_name[0] ?? ''}${e.last_name[0] ?? ''}`.toUpperCase()

const FLAGS: Record<string, string> = {
  India: '🇮🇳',
  'United States': '🇺🇸',
  'United Kingdom': '🇬🇧',
  Germany: '🇩🇪',
  Canada: '🇨🇦',
  Singapore: '🇸🇬',
}
export const countryFlag = (country: string): string => FLAGS[country] ?? '🌐'

/**
 * Parse a user-entered major-unit amount ("1250.5") into integer minor units without
 * floating-point error. Throws a user-facing message for invalid input.
 */
export function salaryToMinorUnits(amount: string): number {
  const normalized = amount.trim().replace(/,/g, '')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter an amount with up to two decimal places.')
  }
  const [whole = '0', fraction = ''] = normalized.split('.')
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(result) || result > 10 ** 15) {
    throw new Error('Enter a salary within the supported range.')
  }
  return result
}

/** Inverse of salaryToMinorUnits for pre-filling inputs: 850000050 → "8500000.50". */
export function minorUnitsToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return ''
  const whole = Math.trunc(minor / 100)
  const cents = Math.abs(minor % 100)
  return cents ? `${whole}.${String(cents).padStart(2, '0')}` : String(whole)
}

/** "employment_status" → "Employment status". */
export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
