import { describe, it, expect } from 'vitest'
import { 
  formatCurrency, 
  parseYearFromQuestion, 
  generateCSV,
  calculatePercentChange 
} from '../utils'

describe('formatCurrency', () => {
  it('formats trillions correctly', () => {
    expect(formatCurrency(1e12)).toBe('$1.00T')
    expect(formatCurrency(1.5e12)).toBe('$1.50T')
  })
  
  it('formats billions correctly', () => {
    expect(formatCurrency(1e9)).toBe('$1.0B')
    expect(formatCurrency(500e9)).toBe('$500.0B')
  })
  
  it('formats millions correctly', () => {
    expect(formatCurrency(1e6)).toBe('$1.0M')
  })
})

describe('parseYearFromQuestion', () => {
  it('parses 4-digit years', () => {
    expect(parseYearFromQuestion('what was spending in 2023?')).toBe(2023)
    expect(parseYearFromQuestion('2019 budget')).toBe(2019)
  })
  
  it('parses FY prefixed years', () => {
    expect(parseYearFromQuestion('what was FY2024 spending?')).toBe(2024)
  })
  
  it('returns null when no valid year', () => {
    expect(parseYearFromQuestion('what is the total debt?')).toBe(null)
  })
})

describe('generateCSV', () => {
  it('generates correct CSV with simple data', () => {
    const data = [{ name: 'A', value: 1 }]
    const columns = [
      { label: 'Name', accessor: row => row.name },
      { label: 'Value', accessor: row => row.value }
    ]
    const result = generateCSV(data, columns)
    expect(result).toContain('Name,Value')
  })
})

describe('calculatePercentChange', () => {
  it('calculates positive change', () => {
    expect(calculatePercentChange(150, 100)).toBe(50)
  })
  
  it('handles zero previous value', () => {
    expect(calculatePercentChange(100, 0)).toBe(0)
  })
})
