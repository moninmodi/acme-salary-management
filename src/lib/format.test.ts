import { describe, expect, it } from 'vitest'

import {
  changeRatio,
  countryFlag,
  formatDate,
  formatMoney,
  formatPct,
  humanize,
  initials,
  minorUnitsToInput,
  salaryToMinorUnits,
} from './format'

describe('formatMoney', () => {
  it('formats minor units in the given currency', () => {
    expect(formatMoney(12_000_000, 'USD')).toBe('$120,000')
    expect(formatMoney(6_300_000, 'GBP')).toBe('£63,000')
  })
  it('supports compact notation for charts', () => {
    expect(formatMoney(385_000_000, 'INR', { compact: true })).toBe('₹3.9M')
  })
  it('shows a dash for missing values instead of zero', () => {
    expect(formatMoney(null, 'USD')).toBe('—')
    expect(formatMoney(100, null)).toBe('—')
  })
})

describe('salaryToMinorUnits', () => {
  it('parses whole and decimal amounts without floating-point error', () => {
    expect(salaryToMinorUnits('120000')).toBe(12_000_000)
    expect(salaryToMinorUnits('0.29')).toBe(29)
    expect(salaryToMinorUnits(' 1,250.5 ')).toBe(125_050)
  })
  it.each(['', 'abc', '-5', '1.234', '1e5'])('rejects %j with a readable message', (value) => {
    expect(() => salaryToMinorUnits(value)).toThrow('up to two decimal places')
  })
  it('rejects amounts beyond the supported range', () => {
    expect(() => salaryToMinorUnits('99999999999999')).toThrow('supported range')
  })
  it('round-trips with minorUnitsToInput', () => {
    for (const minor of [0, 5, 12_000_000, 850_000_050]) {
      expect(salaryToMinorUnits(minorUnitsToInput(minor))).toBe(minor)
    }
    expect(minorUnitsToInput(null)).toBe('')
  })
})

describe('changeRatio and formatPct', () => {
  it('computes signed percentage changes in the same currency', () => {
    expect(formatPct(changeRatio(100_000, 110_000))).toBe('+10.0%')
    expect(formatPct(changeRatio(100_000, 95_000))).toBe('-5.0%')
  })
  it('is not comparable across currencies or without a previous amount', () => {
    expect(changeRatio(100, 200, false)).toBeNull()
    expect(changeRatio(null, 200)).toBeNull()
    expect(formatPct(null)).toBe('—')
  })
})

describe('small helpers', () => {
  it('formats dates in UTC', () => expect(formatDate('2026-04-01')).toBe('Apr 1, 2026'))
  it('builds initials and labels', () => {
    expect(initials({ first_name: 'asha', last_name: 'shah' })).toBe('AS')
    expect(humanize('employment_status')).toBe('Employment status')
    expect(countryFlag('India')).toBe('🇮🇳')
    expect(countryFlag('Atlantis')).toBe('🌐')
  })
})
