// Utility functions extracted for testing

export function formatCurrency(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

export function parseYearFromQuestion(question) {
  const q = question.toLowerCase()
  const yearMatch = q.match(/(?:fy\s*)?20(1[9]|2[0-8])\b/)
  if (yearMatch) {
    return parseInt('20' + yearMatch[1])
  }
  return null
}

export function generateCSV(data, columns) {
  const headers = columns.map(col => col.label).join(',')
  const rows = data.map((row, index) => 
    columns.map(col => {
      let value = col.accessor(row, index)
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  ).join('\n')
  return `${headers}\n${rows}`
}

export function calculatePercentChange(current, previous) {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}
