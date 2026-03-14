import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

// Embedded sample data for GitHub Pages (no backend required)
// Each agency has unique growth patterns and COVID impacts
const SAMPLE_AGENCIES = [
  { code: '075', name: 'Department of Health and Human Services', base_oblig: 1800e9, base_outlay: 1750e9, base_budget: 1900e9, annual_growth: 0.045, covid_boost: 1.35 },
  { code: '028', name: 'Social Security Administration', base_oblig: 1400e9, base_outlay: 1350e9, base_budget: 1450e9, annual_growth: 0.025, covid_boost: 1.08 },
  { code: '097', name: 'Department of Defense', base_oblig: 850e9, base_outlay: 820e9, base_budget: 900e9, annual_growth: 0.02, covid_boost: 1.02 },
  { code: '020', name: 'Department of the Treasury', base_oblig: 650e9, base_outlay: 630e9, base_budget: 700e9, annual_growth: 0.015, covid_boost: 1.85 },
  { code: '036', name: 'Department of Veterans Affairs', base_oblig: 320e9, base_outlay: 310e9, base_budget: 340e9, annual_growth: 0.04, covid_boost: 1.12 },
  { code: '012', name: 'Department of Agriculture', base_oblig: 220e9, base_outlay: 210e9, base_budget: 240e9, annual_growth: 0.02, covid_boost: 1.25 },
  { code: '091', name: 'Department of Education', base_oblig: 180e9, base_outlay: 175e9, base_budget: 200e9, annual_growth: 0.01, covid_boost: 1.45 },
  { code: '069', name: 'Department of Transportation', base_oblig: 120e9, base_outlay: 115e9, base_budget: 130e9, annual_growth: 0.035, covid_boost: 0.92 },
  { code: '024', name: 'Department of Homeland Security', base_oblig: 85e9, base_outlay: 82e9, base_budget: 90e9, annual_growth: 0.03, covid_boost: 1.15 },
  { code: '015', name: 'Department of Justice', base_oblig: 42e9, base_outlay: 40e9, base_budget: 45e9, annual_growth: 0.025, covid_boost: 1.05 },
]

// Year-specific adjustments for certain agencies (e.g., stimulus, infrastructure bills)
const YEAR_ADJUSTMENTS = {
  2020: { '020': 1.5, '091': 1.2 },  // Treasury stimulus, Education relief
  2021: { '020': 1.4, '091': 1.3, '069': 1.1 },  // More stimulus, education, infrastructure
  2022: { '069': 1.25 },  // Infrastructure bill kicks in
  2023: { '069': 1.3, '097': 1.05 },  // Infrastructure continues, defense boost
  2024: { '069': 1.2, '075': 1.05 },  // Infrastructure, healthcare expansion
  2025: { '097': 1.08, '024': 1.1 },  // Defense & security increases
}

// Federal Revenue Sources (FY2019 baseline = $3.46T total)
// Each source has unique growth patterns reflecting economic & policy factors
const SAMPLE_REVENUE = [
  { 
    code: 'individual', 
    name: 'Individual Income Tax', 
    base: 1718e9,        // ~50% of revenue - largest source
    annual_growth: 0.04, // Grows with wages/economy
    covid_impact: 0.90,  // Dropped ~10% in 2020 (unemployment, deferrals)
    recovery_boost: 1.25 // Strong 2021-2022 recovery (stock gains, employment)
  },
  { 
    code: 'payroll', 
    name: 'Payroll Taxes (FICA)', 
    base: 1243e9,        // Social Security + Medicare
    annual_growth: 0.025,// Tied to employment, steady
    covid_impact: 0.97,  // Slight dip from unemployment
    recovery_boost: 1.05 // Quick employment recovery
  },
  { 
    code: 'corporate', 
    name: 'Corporate Income Tax', 
    base: 230e9,         // Volatile, affected by 2017 tax cuts
    annual_growth: 0.03, // Modest baseline
    covid_impact: 0.85,  // Dropped ~15% (business closures)
    recovery_boost: 1.40 // Surged 40%+ in 2021-2022 (record profits)
  },
  { 
    code: 'excise', 
    name: 'Excise Taxes', 
    base: 99e9,          // Gas, tobacco, alcohol, etc.
    annual_growth: 0.01, // Slow growth (declining fuel use)
    covid_impact: 0.85,  // Travel/consumption down
    recovery_boost: 1.10 // Partial recovery
  },
  { 
    code: 'customs', 
    name: 'Customs Duties', 
    base: 71e9,          // Import tariffs
    annual_growth: 0.02, // Trade-dependent
    covid_impact: 0.88,  // Trade disruption
    recovery_boost: 1.08 // Trade recovery
  },
  { 
    code: 'estate', 
    name: 'Estate & Gift Taxes', 
    base: 17e9,          // Small but notable
    annual_growth: 0.035,// Grows with wealth
    covid_impact: 0.95,  // Slight dip
    recovery_boost: 1.20 // Wealth gains drove increase
  },
  { 
    code: 'other', 
    name: 'Other Revenue', 
    base: 85e9,          // Fed Reserve earnings, fees, misc
    annual_growth: 0.02, // Variable
    covid_impact: 1.10,  // Fed earnings actually increased
    recovery_boost: 1.0  // Normalized
  },
]

// Year-specific revenue adjustments (tax policy changes, economic events)
const REVENUE_YEAR_ADJUSTMENTS = {
  2020: { corporate: 0.85 },              // Extra corporate hit
  2021: { individual: 1.15, corporate: 1.30 }, // Strong recovery, stimulus effects
  2022: { individual: 1.10, corporate: 1.25 }, // Peak recovery
  2023: { corporate: 0.95 },              // Normalization
  2024: { individual: 1.02 },             // Steady
  2025: { individual: 1.03, corporate: 1.05 }, // Projected growth
}

// Budget Categories - How Congress views spending
// Mandatory (~65%): Automatic by law, Discretionary (~30%): Annual appropriation, Interest (~5%): Debt payments
const BUDGET_CATEGORIES = [
  // MANDATORY SPENDING - Programs that run automatically by law (entitlements)
  { 
    code: 'social_security', 
    name: 'Social Security', 
    category: 'mandatory',
    base: 1000e9,         // Largest single program
    annual_growth: 0.05,  // 5% - aging population, COLA adjustments
    covid_boost: 1.03     // Slight increase (more claims)
  },
  { 
    code: 'medicare', 
    name: 'Medicare', 
    category: 'mandatory',
    base: 750e9,          // Second largest
    annual_growth: 0.06,  // 6% - healthcare costs + aging
    covid_boost: 1.15     // COVID hospitalizations
  },
  { 
    code: 'medicaid', 
    name: 'Medicaid', 
    category: 'mandatory',
    base: 410e9,          // State-federal program
    annual_growth: 0.04,  // 4% growth
    covid_boost: 1.25     // Expanded enrollment during pandemic
  },
  { 
    code: 'other_mandatory', 
    name: 'Other Mandatory', 
    category: 'mandatory',
    base: 640e9,          // Income security, SNAP, unemployment, veterans
    annual_growth: 0.025, // Modest growth
    covid_boost: 1.65     // Massive spike (unemployment, stimulus checks)
  },
  
  // DISCRETIONARY SPENDING - Requires annual congressional appropriation
  { 
    code: 'defense', 
    name: 'Defense', 
    category: 'discretionary',
    base: 700e9,          // Department of Defense
    annual_growth: 0.025, // 2.5% baseline
    covid_boost: 1.02     // Minimal COVID impact
  },
  { 
    code: 'nondefense', 
    name: 'Non-Defense Discretionary', 
    category: 'discretionary',
    base: 660e9,          // Education, transportation, HHS programs, etc.
    annual_growth: 0.02,  // 2% baseline
    covid_boost: 1.35     // COVID relief, education aid
  },
  
  // NET INTEREST - Payments on the national debt
  { 
    code: 'net_interest', 
    name: 'Net Interest', 
    category: 'interest',
    base: 380e9,          // Growing concern
    annual_growth: 0.08,  // 8% - debt growing, rates rising
    covid_boost: 0.85     // Actually lower (Fed held rates low)
  },
]

// Year-specific adjustments for budget categories
const CATEGORY_YEAR_ADJUSTMENTS = {
  2020: { other_mandatory: 1.8, nondefense: 1.3 },  // CARES Act, stimulus
  2021: { other_mandatory: 1.5, nondefense: 1.25, medicaid: 1.1 },  // American Rescue Plan
  2022: { nondefense: 1.15, net_interest: 1.2 },   // Infrastructure, rates rising
  2023: { defense: 1.08, net_interest: 1.35 },     // Defense boost, higher rates
  2024: { net_interest: 1.25 },                    // Continued rate pressure
  2025: { defense: 1.05, net_interest: 1.15 },     // Projected
}

// National Debt Data - Tracks total debt, GDP, and debt-to-GDP ratio
// FY2019 baseline: $22.7T total debt, $21.4T GDP = 106% debt-to-GDP
const DEBT_DATA = {
  2019: { totalDebt: 22.7e12, publicDebt: 16.8e12, gdp: 21.4e12 },
  2020: { totalDebt: 27.7e12, publicDebt: 21.0e12, gdp: 21.0e12 },  // COVID spike
  2021: { totalDebt: 29.6e12, publicDebt: 22.3e12, gdp: 23.0e12 },  // Recovery
  2022: { totalDebt: 31.4e12, publicDebt: 24.3e12, gdp: 25.5e12 },  // Continued growth
  2023: { totalDebt: 33.2e12, publicDebt: 26.2e12, gdp: 27.4e12 },  // Debt ceiling drama
  2024: { totalDebt: 35.0e12, publicDebt: 27.8e12, gdp: 28.8e12 },  // Continued rise
  2025: { totalDebt: 36.8e12, publicDebt: 29.3e12, gdp: 30.0e12 },  // Projected
}

// Generate debt metrics for a given year
function generateDebtDataForYear(year, revenueTotal, interestPayment) {
  const d = DEBT_DATA[year] || DEBT_DATA[2025]
  const prevD = DEBT_DATA[year - 1] || DEBT_DATA[2019]
  
  const debtToGdp = (d.totalDebt / d.gdp) * 100
  const publicDebtToGdp = (d.publicDebt / d.gdp) * 100
  const interestToRevenue = revenueTotal > 0 ? (interestPayment / revenueTotal) * 100 : 0
  
  const debtYoyChange = year > 2019 ? (d.totalDebt - prevD.totalDebt) / prevD.totalDebt : 0
  const debtPerCapita = d.totalDebt / 335e6  // ~335 million population
  
  return {
    totalDebt: d.totalDebt,
    totalDebt_formatted: formatCurrencyStatic(d.totalDebt),
    publicDebt: d.publicDebt,
    publicDebt_formatted: formatCurrencyStatic(d.publicDebt),
    intragovDebt: d.totalDebt - d.publicDebt,
    intragovDebt_formatted: formatCurrencyStatic(d.totalDebt - d.publicDebt),
    gdp: d.gdp,
    gdp_formatted: formatCurrencyStatic(d.gdp),
    debtToGdp,
    publicDebtToGdp,
    interestToRevenue,
    interestPayment,
    interestPayment_formatted: formatCurrencyStatic(interestPayment),
    debtYoyChange,
    debtPerCapita,
    debtPerCapita_formatted: `$${Math.round(debtPerCapita).toLocaleString()}`,
  }
}

const SAMPLE_STATES = [
  { code: 'CA', name: 'California', base_spending: 512e9, population: 39538223 },
  { code: 'TX', name: 'Texas', base_spending: 398e9, population: 29145505 },
  { code: 'NY', name: 'New York', base_spending: 342e9, population: 19453561 },
  { code: 'FL', name: 'Florida', base_spending: 298e9, population: 21538187 },
  { code: 'PA', name: 'Pennsylvania', base_spending: 201e9, population: 12801989 },
  { code: 'OH', name: 'Ohio', base_spending: 175e9, population: 11799448 },
  { code: 'IL', name: 'Illinois', base_spending: 168e9, population: 12671821 },
  { code: 'NC', name: 'North Carolina', base_spending: 142e9, population: 10439388 },
  { code: 'MI', name: 'Michigan', base_spending: 138e9, population: 10077331 },
  { code: 'GA', name: 'Georgia', base_spending: 132e9, population: 10711908 },
  { code: 'NJ', name: 'New Jersey', base_spending: 125e9, population: 9288994 },
  { code: 'VA', name: 'Virginia', base_spending: 118e9, population: 8631393 },
  { code: 'WA', name: 'Washington', base_spending: 105e9, population: 7614893 },
  { code: 'AZ', name: 'Arizona', base_spending: 98e9, population: 7278717 },
  { code: 'MA', name: 'Massachusetts', base_spending: 95e9, population: 7029917 },
  { code: 'TN', name: 'Tennessee', base_spending: 89e9, population: 6910840 },
  { code: 'IN', name: 'Indiana', base_spending: 85e9, population: 6785528 },
  { code: 'MO', name: 'Missouri', base_spending: 82e9, population: 6154913 },
  { code: 'MD', name: 'Maryland', base_spending: 80e9, population: 6177224 },
  { code: 'WI', name: 'Wisconsin', base_spending: 76e9, population: 5893718 },
  { code: 'CO', name: 'Colorado', base_spending: 74e9, population: 5773714 },
  { code: 'MN', name: 'Minnesota', base_spending: 72e9, population: 5706494 },
  { code: 'SC', name: 'South Carolina', base_spending: 68e9, population: 5118425 },
  { code: 'AL', name: 'Alabama', base_spending: 65e9, population: 5024279 },
  { code: 'LA', name: 'Louisiana', base_spending: 63e9, population: 4657757 },
  { code: 'KY', name: 'Kentucky', base_spending: 60e9, population: 4505836 },
  { code: 'OR', name: 'Oregon', base_spending: 56e9, population: 4237256 },
  { code: 'OK', name: 'Oklahoma', base_spending: 52e9, population: 3959353 },
  { code: 'CT', name: 'Connecticut', base_spending: 50e9, population: 3605944 },
  { code: 'UT', name: 'Utah', base_spending: 42e9, population: 3271616 },
  { code: 'IA', name: 'Iowa', base_spending: 41e9, population: 3190369 },
  { code: 'NV', name: 'Nevada', base_spending: 40e9, population: 3104614 },
  { code: 'AR', name: 'Arkansas', base_spending: 38e9, population: 3011524 },
  { code: 'MS', name: 'Mississippi', base_spending: 37e9, population: 2961279 },
  { code: 'KS', name: 'Kansas', base_spending: 36e9, population: 2937880 },
  { code: 'NM', name: 'New Mexico', base_spending: 34e9, population: 2117522 },
  { code: 'NE', name: 'Nebraska', base_spending: 28e9, population: 1961504 },
  { code: 'ID', name: 'Idaho', base_spending: 24e9, population: 1839106 },
  { code: 'WV', name: 'West Virginia', base_spending: 26e9, population: 1793716 },
  { code: 'HI', name: 'Hawaii', base_spending: 22e9, population: 1455271 },
  { code: 'NH', name: 'New Hampshire', base_spending: 18e9, population: 1377529 },
  { code: 'ME', name: 'Maine', base_spending: 19e9, population: 1362359 },
  { code: 'RI', name: 'Rhode Island', base_spending: 16e9, population: 1097379 },
  { code: 'MT', name: 'Montana', base_spending: 15e9, population: 1084225 },
  { code: 'DE', name: 'Delaware', base_spending: 14e9, population: 989948 },
  { code: 'SD', name: 'South Dakota', base_spending: 13e9, population: 886667 },
  { code: 'ND', name: 'North Dakota', base_spending: 12e9, population: 779094 },
  { code: 'AK', name: 'Alaska', base_spending: 15e9, population: 733391 },
  { code: 'DC', name: 'District of Columbia', base_spending: 45e9, population: 689545 },
  { code: 'VT', name: 'Vermont', base_spending: 10e9, population: 643077 },
  { code: 'WY', name: 'Wyoming', base_spending: 9e9, population: 576851 },
]

// Generate revenue data for a given fiscal year
function generateRevenueForYear(year) {
  const revenues = SAMPLE_REVENUE.map(r => {
    const yearsFromBase = year - 2019
    const growth = Math.pow(1 + r.annual_growth, yearsFromBase)
    
    // COVID impact in 2020, recovery boost in 2021-2022
    let economicFactor = 1.0
    if (year === 2020) economicFactor = r.covid_impact
    else if (year === 2021 || year === 2022) economicFactor = r.recovery_boost
    
    // Year-specific policy adjustments
    const yearAdj = REVENUE_YEAR_ADJUSTMENTS[year]?.[r.code] || 1.0
    
    // Round to nearest million
    const amount = Math.round(r.base * growth * economicFactor * yearAdj / 1e6) * 1e6
    
    // Calculate previous year for YoY
    const prevYearsFromBase = year - 1 - 2019
    const prevGrowth = prevYearsFromBase >= 0 ? Math.pow(1 + r.annual_growth, prevYearsFromBase) : 1
    let prevEconomicFactor = 1.0
    if (year - 1 === 2020) prevEconomicFactor = r.covid_impact
    else if (year - 1 === 2021 || year - 1 === 2022) prevEconomicFactor = r.recovery_boost
    const prevYearAdj = REVENUE_YEAR_ADJUSTMENTS[year - 1]?.[r.code] || 1.0
    const prevAmount = Math.round(r.base * prevGrowth * prevEconomicFactor * prevYearAdj / 1e6) * 1e6
    
    const yoy_change = year > 2019 ? (amount - prevAmount) / prevAmount : 0
    
    return {
      code: r.code,
      name: r.name,
      amount,
      amount_formatted: formatCurrencyStatic(amount),
      percent_of_total: 0,
      yoy_change
    }
  })
  
  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0)
  revenues.forEach(r => { r.percent_of_total = (r.amount / totalRevenue) * 100 })
  
  return { revenues, totalRevenue }
}

// Generate budget category data for a given fiscal year
function generateBudgetCategoriesForYear(year) {
  const categories = BUDGET_CATEGORIES.map(c => {
    const yearsFromBase = year - 2019
    const growth = Math.pow(1 + c.annual_growth, yearsFromBase)
    
    // COVID impact in 2020-2021
    const covidFactor = (year === 2020 || year === 2021) ? c.covid_boost : 1.0
    
    // Year-specific adjustments
    const yearAdj = CATEGORY_YEAR_ADJUSTMENTS[year]?.[c.code] || 1.0
    
    // Round to nearest million
    const amount = Math.round(c.base * growth * covidFactor * yearAdj / 1e6) * 1e6
    
    // Calculate previous year for YoY
    const prevYearsFromBase = year - 1 - 2019
    const prevGrowth = prevYearsFromBase >= 0 ? Math.pow(1 + c.annual_growth, prevYearsFromBase) : 1
    const prevCovidFactor = (year - 1 === 2020 || year - 1 === 2021) ? c.covid_boost : 1.0
    const prevYearAdj = CATEGORY_YEAR_ADJUSTMENTS[year - 1]?.[c.code] || 1.0
    const prevAmount = Math.round(c.base * prevGrowth * prevCovidFactor * prevYearAdj / 1e6) * 1e6
    
    const yoy_change = year > 2019 ? (amount - prevAmount) / prevAmount : 0
    
    return {
      code: c.code,
      name: c.name,
      category: c.category,
      amount,
      amount_formatted: formatCurrencyStatic(amount),
      percent_of_total: 0,
      yoy_change
    }
  })
  
  const totalSpending = categories.reduce((sum, c) => sum + c.amount, 0)
  categories.forEach(c => { c.percent_of_total = (c.amount / totalSpending) * 100 })
  
  // Calculate category totals
  const mandatory = categories.filter(c => c.category === 'mandatory')
  const discretionary = categories.filter(c => c.category === 'discretionary')
  const interest = categories.filter(c => c.category === 'interest')
  
  const totals = {
    mandatory: mandatory.reduce((sum, c) => sum + c.amount, 0),
    discretionary: discretionary.reduce((sum, c) => sum + c.amount, 0),
    interest: interest.reduce((sum, c) => sum + c.amount, 0),
  }
  
  return { 
    categories, 
    totalSpending,
    totals,
    byType: { mandatory, discretionary, interest }
  }
}

function generateDataForYear(year) {
  const agencies = SAMPLE_AGENCIES.map(a => {
    // Agency-specific growth: compound from 2019 baseline
    const yearsFromBase = year - 2019
    const growth = Math.pow(1 + a.annual_growth, yearsFromBase)
    
    // COVID boost only in 2020-2021, varies by agency
    const covidMultiplier = (year === 2020 || year === 2021) ? a.covid_boost : 1.0
    
    // Year-specific policy adjustments
    const yearAdj = YEAR_ADJUSTMENTS[year]?.[a.code] || 1.0
    
    // Round to nearest million for consistent display & calculation
    const outlays = Math.round(a.base_outlay * growth * covidMultiplier * yearAdj / 1e6) * 1e6
    
    // Calculate previous year for YoY (using same rounding)
    const prevYearsFromBase = year - 1 - 2019
    const prevGrowth = Math.pow(1 + a.annual_growth, prevYearsFromBase)
    const prevCovidMultiplier = (year - 1 === 2020 || year - 1 === 2021) ? a.covid_boost : 1.0
    const prevYearAdj = YEAR_ADJUSTMENTS[year - 1]?.[a.code] || 1.0
    const prevOutlays = Math.round(a.base_outlay * prevGrowth * prevCovidMultiplier * prevYearAdj / 1e6) * 1e6
    
    const yoy_change = year > 2019 ? (outlays - prevOutlays) / prevOutlays : 0
    
    return {
      code: a.code,
      name: a.name,
      outlays,
      outlays_formatted: formatCurrencyStatic(outlays),
      percent_of_total: 0,
      yoy_change
    }
  })
  
  const totalAgency = agencies.reduce((sum, a) => sum + a.outlays, 0)
  agencies.forEach(a => { a.percent_of_total = (a.outlays / totalAgency) * 100 })
  
  // States use average 3% growth with regional COVID variation
  const stateBaseGrowth = Math.pow(1.03, year - 2019)
  const states = SAMPLE_STATES.map(s => {
    // Regional COVID impact varies (coastal/urban states hit harder)
    const isHighImpact = ['NY', 'NJ', 'CA', 'MA', 'IL', 'MI', 'PA', 'WA'].includes(s.code)
    const covidFactor = (year === 2020 || year === 2021) ? (isHighImpact ? 1.22 : 1.12) : 1.0
    const outlays = s.base_spending * stateBaseGrowth * covidFactor
    const perCapita = outlays / s.population
    return {
      code: s.code,
      name: s.name,
      outlays,
      outlays_formatted: formatCurrencyStatic(outlays),
      population: s.population,
      per_capita: perCapita,
      per_capita_formatted: `$${Math.round(perCapita).toLocaleString()}`,
      percent_of_total: 0
    }
  })
  
  const totalState = states.reduce((sum, s) => sum + s.outlays, 0)
  states.forEach(s => { s.percent_of_total = (s.outlays / totalState) * 100 })
  
  return { agencies, states, totalAgency }
}

function formatCurrencyStatic(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

// State abbreviation to FIPS code mapping
const STATE_FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27',
  MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35',
  NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53',
  WV: '54', WI: '55', WY: '56'
}

const FIPS_TO_STATE = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([k, v]) => [v, k])
)

function formatCurrency(value) {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

function StatCard({ title, value, subtitle, change }) {
  const isPositive = change && change >= 0
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {change !== undefined && (
        <p className={`text-sm mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(change * 100).toFixed(1)}% vs last year
        </p>
      )}
    </div>
  )
}

function AgencyChart({ agencies }) {
  const data = agencies.map(a => ({
    name: a.name.replace('Department of ', '').replace('the ', '').replace('Administration', 'Admin'),
    value: a.outlays,
    percent: a.percent
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={formatCurrency} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => formatCurrency(v)} />
        <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function RevenueChart({ revenues }) {
  const data = revenues.map(r => ({
    name: r.name.replace(' Taxes', '').replace('Individual ', ''),
    value: r.amount,
    percent: r.percent_of_total
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={formatCurrency} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => formatCurrency(v)} />
        <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip formatter={(v) => [formatCurrency(v), 'Total Spending']} labelFormatter={(l) => `FY ${l}`} />
        <Line 
          type="monotone" 
          dataKey="total_outlays" 
          stroke="#3B82F6" 
          strokeWidth={3}
          dot={{ fill: '#3B82F6', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function RevenueTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip 
          formatter={(v, name) => [formatCurrency(v), name]} 
          labelFormatter={(l) => `FY ${l}`} 
        />
        <Line 
          type="monotone" 
          dataKey="total_revenue" 
          name="Revenue"
          stroke="#10B981" 
          strokeWidth={3}
          dot={{ fill: '#10B981', strokeWidth: 2 }}
        />
        <Line 
          type="monotone" 
          dataKey="total_outlays" 
          name="Spending"
          stroke="#3B82F6" 
          strokeWidth={3}
          strokeDasharray="5 5"
          dot={{ fill: '#3B82F6', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Color scheme for budget categories
const CATEGORY_COLORS = {
  mandatory: '#EF4444',    // Red - urgent, automatic spending
  discretionary: '#3B82F6', // Blue - controllable, appropriated
  interest: '#6B7280',      // Gray - unavoidable debt cost
}

const PROGRAM_COLORS = {
  social_security: '#DC2626',
  medicare: '#F87171',
  medicaid: '#FB923C',
  other_mandatory: '#FBBF24',
  defense: '#3B82F6',
  nondefense: '#60A5FA',
  net_interest: '#6B7280',
}

function CategoryPieChart({ totals, totalSpending }) {
  const data = [
    { name: 'Mandatory', value: totals.mandatory, color: CATEGORY_COLORS.mandatory },
    { name: 'Discretionary', value: totals.discretionary, color: CATEGORY_COLORS.discretionary },
    { name: 'Net Interest', value: totals.interest, color: CATEGORY_COLORS.interest },
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function CategoryTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip formatter={(v) => formatCurrency(v)} />
        <Legend />
        <Bar dataKey="mandatory" name="Mandatory" stackId="a" fill={CATEGORY_COLORS.mandatory} />
        <Bar dataKey="discretionary" name="Discretionary" stackId="a" fill={CATEGORY_COLORS.discretionary} />
        <Bar dataKey="interest" name="Net Interest" stackId="a" fill={CATEGORY_COLORS.interest} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DebtTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis tickFormatter={formatCurrency} />
        <Tooltip 
          formatter={(v, name) => [formatCurrency(v), name]} 
          labelFormatter={(l) => `FY ${l}`} 
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="totalDebt" 
          name="Total Debt"
          stroke="#DC2626" 
          strokeWidth={3}
          dot={{ fill: '#DC2626', strokeWidth: 2 }}
        />
        <Line 
          type="monotone" 
          dataKey="gdp" 
          name="GDP"
          stroke="#10B981" 
          strokeWidth={3}
          strokeDasharray="5 5"
          dot={{ fill: '#10B981', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function DebtToGdpChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis domain={[80, 140]} tickFormatter={(v) => `${v}%`} />
        <Tooltip 
          formatter={(v) => [`${v.toFixed(1)}%`, 'Debt-to-GDP']} 
          labelFormatter={(l) => `FY ${l}`} 
        />
        <Line 
          type="monotone" 
          dataKey="debtToGdp" 
          name="Debt-to-GDP"
          stroke="#DC2626" 
          strokeWidth={3}
          dot={{ fill: '#DC2626', strokeWidth: 2 }}
        />
        {/* 100% threshold line */}
        <Line 
          type="monotone" 
          dataKey="threshold" 
          name="100% Threshold"
          stroke="#6B7280" 
          strokeWidth={1}
          strokeDasharray="10 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function USMap({ states, onStateHover }) {
  const [hoveredState, setHoveredState] = useState(null)
  
  // Create lookup by state code
  const stateData = {}
  states.forEach(s => { stateData[s.code] = s })
  
  // Color scale based on spending
  const maxSpending = Math.max(...states.map(s => s.outlays))
  const getColor = (spending) => {
    const ratio = spending / maxSpending
    const intensity = Math.floor(ratio * 200 + 55)
    return `rgb(${255 - intensity}, ${255 - intensity * 0.3}, 255)`
  }

  return (
    <div className="relative">
      <ComposableMap projection="geoAlbersUsa" className="w-full h-auto">
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map(geo => {
              const stateCode = FIPS_TO_STATE[geo.id]
              const state = stateData[stateCode]
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={state ? getColor(state.outlays) : '#EEE'}
                  stroke="#FFF"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#3B82F6', cursor: 'pointer' },
                    pressed: { outline: 'none' }
                  }}
                  onMouseEnter={() => setHoveredState(state)}
                  onMouseLeave={() => setHoveredState(null)}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>
      
      {/* Tooltip */}
      {hoveredState && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-gray-200 min-w-[200px]">
          <h4 className="font-bold text-gray-900 text-lg">{hoveredState.name}</h4>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Spending:</span>
              <span className="font-semibold text-gray-900">{hoveredState.outlays_formatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Per Capita:</span>
              <span className="font-semibold text-gray-900">{hoveredState.per_capita_formatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">% of Total:</span>
              <span className="font-semibold text-gray-900">{hoveredState.percent_of_total.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow p-3 border border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Federal Spending</p>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">Low</span>
          <div className="w-24 h-3 rounded" style={{ background: 'linear-gradient(to right, rgb(200, 230, 255), rgb(55, 55, 255))' }}></div>
          <span className="text-xs text-gray-400">High</span>
        </div>
      </div>
    </div>
  )
}

function StateTable({ states }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spending</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Per Capita</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {states.map((state, idx) => (
            <tr key={state.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-medium text-gray-900">{state.name}</span>
                <span className="ml-2 text-gray-400">({state.code})</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-900">{state.outlays_formatted}</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-900">{state.per_capita_formatted}</td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-500">{state.percent_of_total.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [selectedYear, setSelectedYear] = useState(2025)
  const [activeTab, setActiveTab] = useState('overview')

  // Generate spending data for selected year
  const data = useMemo(() => generateDataForYear(selectedYear), [selectedYear])
  
  // Generate revenue data for selected year
  const revenueData = useMemo(() => generateRevenueForYear(selectedYear), [selectedYear])
  
  // Generate budget category data for selected year
  const budgetData = useMemo(() => generateBudgetCategoriesForYear(selectedYear), [selectedYear])
  
  // Calculate deficit (spending - revenue)
  const deficit = data.totalAgency - revenueData.totalRevenue
  
  // Generate trend data for all years (including revenue for comparison)
  const trend = useMemo(() => ({
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map(year => {
      const yearData = generateDataForYear(year)
      const yearRevenue = generateRevenueForYear(year)
      return { 
        fiscal_year: year, 
        total_outlays: yearData.totalAgency,
        total_revenue: yearRevenue.totalRevenue,
        deficit: yearData.totalAgency - yearRevenue.totalRevenue
      }
    })
  }), [])

  // Generate budget category trend data
  const categoryTrend = useMemo(() => ({
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map(year => {
      const yearBudget = generateBudgetCategoriesForYear(year)
      return { 
        fiscal_year: year, 
        mandatory: yearBudget.totals.mandatory,
        discretionary: yearBudget.totals.discretionary,
        interest: yearBudget.totals.interest,
        total: yearBudget.totalSpending
      }
    })
  }), [])

  // Generate debt data for selected year
  const interestPayment = budgetData.totals.interest
  const debtData = useMemo(() => 
    generateDebtDataForYear(selectedYear, revenueData.totalRevenue, interestPayment), 
    [selectedYear, revenueData.totalRevenue, interestPayment]
  )
  
  // Generate debt trend data
  const debtTrend = useMemo(() => ({
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map(year => {
      const yearRevenue = generateRevenueForYear(year)
      const yearBudget = generateBudgetCategoriesForYear(year)
      const yearDebt = generateDebtDataForYear(year, yearRevenue.totalRevenue, yearBudget.totals.interest)
      return { 
        fiscal_year: year, 
        totalDebt: yearDebt.totalDebt,
        gdp: yearDebt.gdp,
        debtToGdp: yearDebt.debtToGdp,
        threshold: 100  // 100% debt-to-GDP reference line
      }
    })
  }), [])

  // Calculate actual overview YoY change
  const prevYearData = selectedYear > 2019 ? generateDataForYear(selectedYear - 1) : null
  const overviewYoyChange = prevYearData 
    ? (data.totalAgency - prevYearData.totalAgency) / prevYearData.totalAgency 
    : 0

  // Calculate revenue YoY change
  const prevRevenueData = selectedYear > 2019 ? generateRevenueForYear(selectedYear - 1) : null
  const revenueYoyChange = prevRevenueData 
    ? (revenueData.totalRevenue - prevRevenueData.totalRevenue) / prevRevenueData.totalRevenue 
    : 0

  const overview = {
    fiscal_year: selectedYear,
    total_outlays: data.totalAgency,
    total_outlays_formatted: formatCurrencyStatic(data.totalAgency),
    total_revenue: revenueData.totalRevenue,
    total_revenue_formatted: formatCurrencyStatic(revenueData.totalRevenue),
    deficit: deficit,
    deficit_formatted: formatCurrencyStatic(Math.abs(deficit)),
    agency_count: data.agencies.length,
    top_agencies: data.agencies.slice(0, 5),
    top_revenue_sources: revenueData.revenues.slice(0, 3),
    year_over_year_change: overviewYoyChange,
    revenue_yoy_change: revenueYoyChange
  }

  const agencies = { agencies: data.agencies, fiscal_year: selectedYear }
  const states = { states: data.states, fiscal_year: selectedYear }
  const revenue = { revenues: revenueData.revenues, total: revenueData.totalRevenue, fiscal_year: selectedYear }
  const budget = { 
    categories: budgetData.categories, 
    totals: budgetData.totals,
    byType: budgetData.byType,
    totalSpending: budgetData.totalSpending, 
    fiscal_year: selectedYear 
  }
  
  const debt = {
    ...debtData,
    fiscal_year: selectedYear
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="bg-blue-900 text-white py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-center">Neil Mahajan Federal Spending Analysis</h1>
        </div>
      </div>
      
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Federal Spending Dashboard</h1>
              <p className="text-sm text-gray-500">Tracking $6+ trillion in annual federal spending</p>
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-600">Fiscal Year:</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
              >
                {[2025, 2024, 2023, 2022, 2021, 2020, 2019].map(y => (
                  <option key={y} value={y}>FY {y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'revenue', label: 'Revenue' },
              { id: 'budget', label: 'Budget' },
              { id: 'debt', label: 'Debt' },
              { id: 'agencies', label: 'Agencies' },
              { id: 'states', label: 'States' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'overview' && overview && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Federal Spending" 
                value={overview.total_outlays_formatted}
                subtitle={`FY ${overview.fiscal_year}`}
                change={overview.year_over_year_change}
              />
              <StatCard 
                title="Total Federal Revenue" 
                value={overview.total_revenue_formatted}
                subtitle={`FY ${overview.fiscal_year}`}
                change={overview.revenue_yoy_change}
              />
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Budget Deficit</p>
                <p className="text-3xl font-bold text-red-600 mt-2">-{overview.deficit_formatted}</p>
                <p className="text-sm text-gray-500 mt-1">Spending exceeds revenue</p>
              </div>
              <StatCard 
                title="Top Agency" 
                value={overview.top_agencies[0]?.outlays_formatted}
                subtitle={overview.top_agencies[0]?.name}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Spending Trend</h3>
                <div className="flex gap-4 mb-2 text-sm">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Spending</span>
                </div>
                {trend && <RevenueTrendChart data={trend.years} />}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Agencies</h3>
                <AgencyChart agencies={overview.top_agencies} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && revenue && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Total Federal Revenue" 
                value={formatCurrencyStatic(revenue.total)}
                subtitle={`FY ${revenue.fiscal_year}`}
                change={revenueYoyChange}
              />
              <StatCard 
                title="Top Revenue Source" 
                value={revenue.revenues[0]?.amount_formatted}
                subtitle={revenue.revenues[0]?.name}
              />
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Budget Deficit</p>
                <p className="text-3xl font-bold text-red-600 mt-2">-{formatCurrencyStatic(Math.abs(deficit))}</p>
                <p className="text-sm text-gray-500 mt-1">{((deficit / revenue.total) * 100).toFixed(0)}% of revenue</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Source - FY {revenue.fiscal_year}</h3>
                <RevenueChart revenues={revenue.revenues} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue vs Spending Trend</h3>
                <div className="flex gap-4 mb-2 text-sm">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Spending</span>
                </div>
                {trend && <RevenueTrendChart data={trend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Revenue Sources - FY {revenue.fiscal_year}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">YoY Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {revenue.revenues.map((source, idx) => (
                      <tr key={source.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 font-medium text-gray-900">{source.name}</td>
                        <td className="px-6 py-4 text-gray-900">{source.amount_formatted}</td>
                        <td className="px-6 py-4 text-gray-500">{source.percent_of_total.toFixed(1)}%</td>
                        <td className="px-6 py-4">
                          <span className={source.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {source.yoy_change >= 0 ? '+' : ''}{(source.yoy_change * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && budget && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <p className="text-sm font-medium text-gray-500">Mandatory Spending</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrencyStatic(budget.totals.mandatory)}</p>
                <p className="text-sm text-gray-500 mt-1">{((budget.totals.mandatory / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <p className="text-sm font-medium text-gray-500">Discretionary Spending</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrencyStatic(budget.totals.discretionary)}</p>
                <p className="text-sm text-gray-500 mt-1">{((budget.totals.discretionary / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <p className="text-sm font-medium text-gray-500">Net Interest</p>
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrencyStatic(budget.totals.interest)}</p>
                <p className="text-sm text-gray-500 mt-1">{((budget.totals.interest / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Composition - FY {budget.fiscal_year}</h3>
                <CategoryPieChart totals={budget.totals} totalSpending={budget.totalSpending} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Trends Over Time</h3>
                {categoryTrend && <CategoryTrendChart data={categoryTrend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Budget Categories - FY {budget.fiscal_year}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">YoY Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {budget.categories.map((cat, idx) => (
                      <tr key={cat.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            cat.category === 'mandatory' ? 'bg-red-100 text-red-800' :
                            cat.category === 'discretionary' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">{cat.name}</td>
                        <td className="px-6 py-4 text-gray-900">{cat.amount_formatted}</td>
                        <td className="px-6 py-4 text-gray-500">{cat.percent_of_total.toFixed(1)}%</td>
                        <td className="px-6 py-4">
                          <span className={cat.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {cat.yoy_change >= 0 ? '+' : ''}{(cat.yoy_change * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
              <h4 className="font-semibold text-amber-800 mb-2">Understanding Budget Categories</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li><strong>Mandatory (65%):</strong> Spending required by law - Social Security, Medicare, Medicaid. Grows automatically.</li>
                <li><strong>Discretionary (30%):</strong> Requires annual congressional appropriation - defense, education, transportation.</li>
                <li><strong>Net Interest (5%):</strong> Interest payments on the national debt. Growing rapidly as debt increases.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'debt' && debt && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Total National Debt</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{debt.totalDebt_formatted}</p>
                <p className="text-sm text-gray-500 mt-1">FY {debt.fiscal_year}</p>
                {debt.debtYoyChange !== 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ↑ {(debt.debtYoyChange * 100).toFixed(1)}% vs last year
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Debt-to-GDP Ratio</p>
                <p className={`text-3xl font-bold mt-2 ${debt.debtToGdp > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                  {debt.debtToGdp.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500 mt-1">GDP: {debt.gdp_formatted}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Interest Payments</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{debt.interestPayment_formatted}</p>
                <p className="text-sm text-gray-500 mt-1">{debt.interestToRevenue.toFixed(1)}% of revenue</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500">Debt Per Citizen</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{debt.debtPerCapita_formatted}</p>
                <p className="text-sm text-gray-500 mt-1">Per capita share</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt vs GDP Trend</h3>
                <div className="flex gap-4 mb-2 text-sm">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded"></span> Total Debt</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> GDP</span>
                </div>
                {debtTrend && <DebtTrendChart data={debtTrend.years} />}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt-to-GDP Ratio Trend</h3>
                <p className="text-sm text-gray-500 mb-2">Above 100% = Debt exceeds annual economic output</p>
                {debtTrend && <DebtToGdpChart data={debtTrend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Debt Breakdown - FY {debt.fiscal_year}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">By Holder</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Debt Held by Public</p>
                        <p className="text-sm text-gray-500">Foreign governments, investors, Fed</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{debt.publicDebt_formatted}</p>
                        <p className="text-sm text-gray-500">{((debt.publicDebt / debt.totalDebt) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Intragovernmental Holdings</p>
                        <p className="text-sm text-gray-500">Social Security trust fund, etc.</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{debt.intragovDebt_formatted}</p>
                        <p className="text-sm text-gray-500">{((debt.intragovDebt / debt.totalDebt) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-3">Key Ratios</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">Public Debt-to-GDP</p>
                      <p className={`font-bold ${debt.publicDebtToGdp > 80 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {debt.publicDebtToGdp.toFixed(1)}%
                      </p>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">Interest as % of Revenue</p>
                      <p className={`font-bold ${debt.interestToRevenue > 15 ? 'text-red-600' : 'text-gray-900'}`}>
                        {debt.interestToRevenue.toFixed(1)}%
                      </p>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">Year-over-Year Change</p>
                      <p className="font-bold text-red-600">
                        +{(debt.debtYoyChange * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl border border-red-200 p-6">
              <h4 className="font-semibold text-red-800 mb-2">Understanding the National Debt</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li><strong>Debt-to-GDP above 100%:</strong> The debt exceeds the entire annual economic output of the country.</li>
                <li><strong>Interest crowding out:</strong> As interest payments grow, less is available for programs and investments.</li>
                <li><strong>Public debt matters most:</strong> This is what the government owes to external creditors and must pay interest on.</li>
                <li><strong>Sustainability concern:</strong> If interest rates rise or GDP slows, debt servicing becomes more difficult.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'agencies' && agencies && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">All Federal Agencies - FY {selectedYear}</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outlays</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">YoY Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {agencies.agencies.map((agency, idx) => (
                    <tr key={agency.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{agency.name}</span>
                        <span className="ml-2 text-xs text-gray-400">({agency.code})</span>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{agency.outlays_formatted}</td>
                      <td className="px-6 py-4 text-gray-500">{agency.percent_of_total.toFixed(1)}%</td>
                      <td className="px-6 py-4">
                        <span className={agency.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {agency.yoy_change >= 0 ? '+' : ''}{(agency.yoy_change * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'states' && states && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Interactive Spending Map - FY {selectedYear}</h3>
              <p className="text-sm text-gray-500 mb-4">Hover over a state to see spending details</p>
              <USMap states={states.states} />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">State-by-State Spending - FY {selectedYear}</h3>
              <StateTable states={states.states} />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-gray-500 text-center">
            Data sourced from USAspending.gov | Built for transparency in federal spending
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
