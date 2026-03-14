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

// Federal Workforce Data - Civilian employees by agency
// FY2019 baseline: ~2.1 million total federal civilian employees
const WORKFORCE_AGENCIES = [
  { code: 'DOD', name: 'Defense (Civilian)', base_employees: 750000, avg_salary: 85000, annual_growth: 0.005, covid_change: 1.02 },
  { code: 'VA', name: 'Veterans Affairs', base_employees: 380000, avg_salary: 78000, annual_growth: 0.04, covid_change: 1.08 },
  { code: 'DHS', name: 'Homeland Security', base_employees: 240000, avg_salary: 82000, annual_growth: 0.015, covid_change: 1.03 },
  { code: 'DOJ', name: 'Justice', base_employees: 115000, avg_salary: 90000, annual_growth: 0.01, covid_change: 1.01 },
  { code: 'TRES', name: 'Treasury', base_employees: 90000, avg_salary: 88000, annual_growth: -0.01, covid_change: 0.98 },
  { code: 'USDA', name: 'Agriculture', base_employees: 85000, avg_salary: 72000, annual_growth: 0.005, covid_change: 1.0 },
  { code: 'HHS', name: 'Health & Human Services', base_employees: 80000, avg_salary: 95000, annual_growth: 0.025, covid_change: 1.12 },
  { code: 'DOI', name: 'Interior', base_employees: 65000, avg_salary: 70000, annual_growth: 0.0, covid_change: 0.98 },
  { code: 'SSA', name: 'Social Security Admin', base_employees: 60000, avg_salary: 75000, annual_growth: -0.015, covid_change: 0.97 },
  { code: 'OTHER', name: 'All Other Agencies', base_employees: 235000, avg_salary: 80000, annual_growth: 0.01, covid_change: 1.02 },
]

// Contractor spending data (complements federal workforce)
const CONTRACTOR_DATA = {
  2019: { spending: 560e9, estimated_fte: 4200000 },  // Estimated full-time equivalent contractors
  2020: { spending: 610e9, estimated_fte: 4400000 },  // COVID surge
  2021: { spending: 650e9, estimated_fte: 4500000 },
  2022: { spending: 680e9, estimated_fte: 4600000 },
  2023: { spending: 710e9, estimated_fte: 4700000 },
  2024: { spending: 740e9, estimated_fte: 4800000 },
  2025: { spending: 770e9, estimated_fte: 4900000 },
}

// Top Federal Contractors (FY2019 baseline)
// Defense contractors dominate federal procurement
const TOP_CONTRACTORS = [
  { name: 'Lockheed Martin', base: 48e9, sector: 'Defense', growth: 0.04 },
  { name: 'Boeing', base: 28e9, sector: 'Defense', growth: 0.02 },
  { name: 'Raytheon', base: 24e9, sector: 'Defense', growth: 0.05 },
  { name: 'General Dynamics', base: 20e9, sector: 'Defense', growth: 0.035 },
  { name: 'Northrop Grumman', base: 18e9, sector: 'Defense', growth: 0.045 },
  { name: 'McKesson', base: 8e9, sector: 'Healthcare', growth: 0.06 },
  { name: 'Humana', base: 7e9, sector: 'Healthcare', growth: 0.05 },
  { name: 'Leidos', base: 6e9, sector: 'IT Services', growth: 0.08 },
  { name: 'Booz Allen Hamilton', base: 5.5e9, sector: 'Consulting', growth: 0.06 },
  { name: 'SAIC', base: 4.5e9, sector: 'IT Services', growth: 0.05 },
]

// Contract Categories (FY2019 baseline)
const CONTRACT_CATEGORIES = [
  { name: 'Defense & Military', base: 380e9, growth: 0.03, covid_boost: 1.02 },
  { name: 'IT & Technology', base: 95e9, growth: 0.06, covid_boost: 1.15 },
  { name: 'Professional Services', base: 75e9, growth: 0.04, covid_boost: 1.08 },
  { name: 'Healthcare Services', base: 45e9, growth: 0.05, covid_boost: 1.25 },
  { name: 'Construction', base: 30e9, growth: 0.025, covid_boost: 0.90 },
  { name: 'Research & Development', base: 28e9, growth: 0.05, covid_boost: 1.20 },
  { name: 'Other Services', base: 47e9, growth: 0.03, covid_boost: 1.05 },
]

// Federal Grants Data (FY2019 baseline)
const GRANT_CATEGORIES = [
  { name: 'Healthcare & Medicaid', base: 450e9, growth: 0.05, covid_boost: 1.30 },
  { name: 'Income Security', base: 180e9, growth: 0.025, covid_boost: 1.60 },
  { name: 'Education', base: 75e9, growth: 0.02, covid_boost: 1.35 },
  { name: 'Transportation', base: 70e9, growth: 0.03, covid_boost: 0.95 },
  { name: 'Research Grants', base: 45e9, growth: 0.04, covid_boost: 1.10 },
  { name: 'Housing & Community', base: 35e9, growth: 0.025, covid_boost: 1.20 },
  { name: 'Other Grants', base: 55e9, growth: 0.03, covid_boost: 1.15 },
]

// Competition rates for contracts
const COMPETITION_DATA = {
  2019: { competed: 62, sole_source: 28, other: 10 },
  2020: { competed: 58, sole_source: 32, other: 10 },  // COVID urgency
  2021: { competed: 55, sole_source: 35, other: 10 },  // Continued urgency
  2022: { competed: 60, sole_source: 30, other: 10 },
  2023: { competed: 63, sole_source: 27, other: 10 },
  2024: { competed: 65, sole_source: 25, other: 10 },
  2025: { competed: 66, sole_source: 24, other: 10 },
}

// Generate contracts & grants data for a given year
function generateContractsDataForYear(year) {
  const yearsFromBase = year - 2019
  
  // Top contractors
  const contractors = TOP_CONTRACTORS.map(c => {
    const growth = Math.pow(1 + c.growth, yearsFromBase)
    const amount = Math.round(c.base * growth / 1e6) * 1e6
    return {
      name: c.name,
      sector: c.sector,
      amount,
      amount_formatted: formatCurrencyStatic(amount)
    }
  })
  
  // Contract categories
  const categories = CONTRACT_CATEGORIES.map(cat => {
    const growth = Math.pow(1 + cat.growth, yearsFromBase)
    const covidFactor = (year === 2020 || year === 2021) ? cat.covid_boost : 1.0
    const amount = Math.round(cat.base * growth * covidFactor / 1e6) * 1e6
    return {
      name: cat.name,
      amount,
      amount_formatted: formatCurrencyStatic(amount),
      percent: 0
    }
  })
  const totalContracts = categories.reduce((sum, c) => sum + c.amount, 0)
  categories.forEach(c => { c.percent = (c.amount / totalContracts) * 100 })
  
  // Grant categories
  const grants = GRANT_CATEGORIES.map(g => {
    const growth = Math.pow(1 + g.growth, yearsFromBase)
    const covidFactor = (year === 2020 || year === 2021) ? g.covid_boost : 1.0
    const amount = Math.round(g.base * growth * covidFactor / 1e6) * 1e6
    return {
      name: g.name,
      amount,
      amount_formatted: formatCurrencyStatic(amount),
      percent: 0
    }
  })
  const totalGrants = grants.reduce((sum, g) => sum + g.amount, 0)
  grants.forEach(g => { g.percent = (g.amount / totalGrants) * 100 })
  
  // Competition data
  const competition = COMPETITION_DATA[year] || COMPETITION_DATA[2025]
  
  return {
    contractors,
    topContractorTotal: contractors.reduce((sum, c) => sum + c.amount, 0),
    topContractorTotal_formatted: formatCurrencyStatic(contractors.reduce((sum, c) => sum + c.amount, 0)),
    categories,
    totalContracts,
    totalContracts_formatted: formatCurrencyStatic(totalContracts),
    grants,
    totalGrants,
    totalGrants_formatted: formatCurrencyStatic(totalGrants),
    competition,
    combined: totalContracts + totalGrants,
    combined_formatted: formatCurrencyStatic(totalContracts + totalGrants)
  }
}

// Generate workforce data for a given year
function generateWorkforceDataForYear(year) {
  const agencies = WORKFORCE_AGENCIES.map(a => {
    const yearsFromBase = year - 2019
    const growth = Math.pow(1 + a.annual_growth, yearsFromBase)
    const covidFactor = (year === 2020 || year === 2021) ? a.covid_change : 1.0
    
    const employees = Math.round(a.base_employees * growth * covidFactor)
    const salaryGrowth = Math.pow(1.025, yearsFromBase)  // ~2.5% annual salary growth
    const avgSalary = Math.round(a.avg_salary * salaryGrowth)
    const totalComp = employees * avgSalary
    
    // Calculate YoY change
    const prevYearsFromBase = year - 1 - 2019
    const prevGrowth = prevYearsFromBase >= 0 ? Math.pow(1 + a.annual_growth, prevYearsFromBase) : 1
    const prevCovidFactor = (year - 1 === 2020 || year - 1 === 2021) ? a.covid_change : 1.0
    const prevEmployees = Math.round(a.base_employees * prevGrowth * prevCovidFactor)
    const yoy_change = year > 2019 ? (employees - prevEmployees) / prevEmployees : 0
    
    return {
      code: a.code,
      name: a.name,
      employees,
      employees_formatted: employees.toLocaleString(),
      avg_salary: avgSalary,
      avg_salary_formatted: `$${avgSalary.toLocaleString()}`,
      total_compensation: totalComp,
      total_compensation_formatted: formatCurrencyStatic(totalComp),
      percent_of_total: 0,
      yoy_change
    }
  })
  
  const totalEmployees = agencies.reduce((sum, a) => sum + a.employees, 0)
  const totalCompensation = agencies.reduce((sum, a) => sum + a.total_compensation, 0)
  agencies.forEach(a => { a.percent_of_total = (a.employees / totalEmployees) * 100 })
  
  // Contractor data for comparison
  const contractors = CONTRACTOR_DATA[year] || CONTRACTOR_DATA[2025]
  
  return {
    agencies,
    totalEmployees,
    totalEmployees_formatted: totalEmployees.toLocaleString(),
    totalCompensation,
    totalCompensation_formatted: formatCurrencyStatic(totalCompensation),
    avgSalaryAll: Math.round(totalCompensation / totalEmployees),
    contractorSpending: contractors.spending,
    contractorSpending_formatted: formatCurrencyStatic(contractors.spending),
    contractorFTE: contractors.estimated_fte,
    contractorFTE_formatted: contractors.estimated_fte.toLocaleString(),
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

function WorkforceChart({ agencies }) {
  const data = agencies.slice(0, 8).map(a => ({
    name: a.name.replace('Department of ', '').replace(' Admin', ''),
    employees: a.employees,
    compensation: a.total_compensation
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => v.toLocaleString()} />
        <Bar dataKey="employees" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function WorkforceTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fiscal_year" />
        <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
        <Tooltip 
          formatter={(v, name) => [v.toLocaleString(), name]} 
          labelFormatter={(l) => `FY ${l}`} 
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="federal" 
          name="Federal Employees"
          stroke="#8B5CF6" 
          strokeWidth={3}
          dot={{ fill: '#8B5CF6', strokeWidth: 2 }}
        />
        <Line 
          type="monotone" 
          dataKey="contractors" 
          name="Contractors (Est.)"
          stroke="#F59E0B" 
          strokeWidth={3}
          strokeDasharray="5 5"
          dot={{ fill: '#F59E0B', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TopContractorsChart({ contractors }) {
  const data = contractors.slice(0, 8).map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    amount: c.amount,
    sector: c.sector
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={formatCurrency} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => formatCurrency(v)} />
        <Bar dataKey="amount" fill="#F97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ContractCategoryChart({ categories }) {
  const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#6B7280']
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={categories}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="amount"
          nameKey="name"
          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {categories.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function GrantsCategoryChart({ grants }) {
  const COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#059669', '#047857', '#6B7280']
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={grants}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
          dataKey="amount"
          nameKey="name"
          label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {grants.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(v)} />
      </PieChart>
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
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-white rounded-lg shadow-lg p-3 sm:p-4 border border-gray-200 min-w-[160px] sm:min-w-[200px] z-10">
          <h4 className="font-bold text-gray-900 text-sm sm:text-lg">{hoveredState.name}</h4>
          <div className="mt-1.5 sm:mt-2 space-y-1">
            <div className="flex justify-between gap-2 text-xs sm:text-sm">
              <span className="text-gray-500">Spending:</span>
              <span className="font-semibold text-gray-900">{hoveredState.outlays_formatted}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs sm:text-sm">
              <span className="text-gray-500">Per Capita:</span>
              <span className="font-semibold text-gray-900">{hoveredState.per_capita_formatted}</span>
            </div>
            <div className="flex justify-between gap-2 text-xs sm:text-sm">
              <span className="text-gray-500">% of Total:</span>
              <span className="font-semibold text-gray-900">{hoveredState.percent_of_total.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 bg-white rounded-lg shadow p-2 sm:p-3 border border-gray-200">
        <p className="text-[10px] sm:text-xs text-gray-500 mb-1 sm:mb-2">Federal Spending</p>
        <div className="flex items-center gap-1">
          <span className="text-[10px] sm:text-xs text-gray-400">Low</span>
          <div className="w-16 sm:w-24 h-2 sm:h-3 rounded" style={{ background: 'linear-gradient(to right, rgb(200, 230, 255), rgb(55, 55, 255))' }}></div>
          <span className="text-[10px] sm:text-xs text-gray-400">High</span>
        </div>
      </div>
    </div>
  )
}

function StateTable({ states }) {
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spending</th>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Per Capita</th>
            <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">% of Total</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {states.map((state, idx) => (
            <tr key={state.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                <span className="font-medium text-gray-900 text-xs sm:text-sm">{state.name}</span>
              </td>
              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-900 text-xs sm:text-sm">{state.outlays_formatted}</td>
              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-900 text-xs sm:text-sm hidden sm:table-cell">{state.per_capita_formatted}</td>
              <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-gray-500 text-xs sm:text-sm hidden sm:table-cell">{state.percent_of_total.toFixed(1)}%</td>
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

  // Generate workforce data for selected year
  const workforceData = useMemo(() => generateWorkforceDataForYear(selectedYear), [selectedYear])
  
  // Generate workforce trend data
  const workforceTrend = useMemo(() => ({
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025].map(year => {
      const yearWorkforce = generateWorkforceDataForYear(year)
      return { 
        fiscal_year: year, 
        federal: yearWorkforce.totalEmployees,
        contractors: yearWorkforce.contractorFTE,
        compensation: yearWorkforce.totalCompensation
      }
    })
  }), [])

  // Generate contracts & grants data for selected year
  const contractsData = useMemo(() => generateContractsDataForYear(selectedYear), [selectedYear])

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
  
  const workforce = {
    ...workforceData,
    fiscal_year: selectedYear
  }
  
  const contracts = {
    ...contractsData,
    fiscal_year: selectedYear
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project Header */}
      <div className="bg-blue-900 text-white py-2 sm:py-3">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <h1 className="text-base sm:text-xl font-bold text-center">Neil Mahajan Federal Spending Analysis</h1>
        </div>
      </div>
      
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Federal Spending Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-500">Tracking $6+ trillion in annual federal spending</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <label className="text-xs sm:text-sm text-gray-600">Fiscal Year:</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-gray-300 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 text-sm"
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
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex gap-1 sm:gap-4 md:gap-8 overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'revenue', label: 'Revenue' },
              { id: 'budget', label: 'Budget' },
              { id: 'debt', label: 'Debt' },
              { id: 'workforce', label: 'Workforce' },
              { id: 'contracts', label: 'Contracts' },
              { id: 'agencies', label: 'Agencies' },
              { id: 'states', label: 'States' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
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

      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        {activeTab === 'overview' && overview && (
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Budget Deficit</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">-{overview.deficit_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Spending exceeds revenue</p>
              </div>
              <StatCard 
                title="Top Agency" 
                value={overview.top_agencies[0]?.outlays_formatted}
                subtitle={overview.top_agencies[0]?.name}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Revenue vs Spending Trend</h3>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 text-xs sm:text-sm">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded"></span> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded"></span> Spending</span>
                </div>
                {trend && <RevenueTrendChart data={trend.years} />}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Top 5 Agencies</h3>
                <AgencyChart agencies={overview.top_agencies} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && revenue && (
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
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
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Budget Deficit</p>
                <p className="text-xl sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">-{formatCurrencyStatic(Math.abs(deficit))}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{((deficit / revenue.total) * 100).toFixed(0)}% of revenue</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Revenue by Source - FY {revenue.fiscal_year}</h3>
                <RevenueChart revenues={revenue.revenues} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Revenue vs Spending Trend</h3>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 text-xs sm:text-sm">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded"></span> Revenue</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-500 rounded"></span> Spending</span>
                </div>
                {trend && <RevenueTrendChart data={trend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">All Revenue Sources - FY {revenue.fiscal_year}</h3>
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
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Mandatory Spending</p>
                </div>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{formatCurrencyStatic(budget.totals.mandatory)}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{((budget.totals.mandatory / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Discretionary Spending</p>
                </div>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{formatCurrencyStatic(budget.totals.discretionary)}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{((budget.totals.discretionary / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-500"></div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Net Interest</p>
                </div>
                <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{formatCurrencyStatic(budget.totals.interest)}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{((budget.totals.interest / budget.totalSpending) * 100).toFixed(0)}% of total</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Budget Composition - FY {budget.fiscal_year}</h3>
                <CategoryPieChart totals={budget.totals} totalSpending={budget.totalSpending} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Category Trends Over Time</h3>
                {categoryTrend && <CategoryTrendChart data={categoryTrend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">All Budget Categories - FY {budget.fiscal_year}</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">% of Total</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">YoY Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {budget.categories.map((cat, idx) => (
                      <tr key={cat.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                            cat.category === 'mandatory' ? 'bg-red-100 text-red-800' :
                            cat.category === 'discretionary' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-gray-900 text-xs sm:text-sm">{cat.name}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm">{cat.amount_formatted}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm hidden sm:table-cell">{cat.percent_of_total.toFixed(1)}%</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                          <span className={`text-xs sm:text-sm ${cat.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {cat.yoy_change >= 0 ? '+' : ''}{(cat.yoy_change * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 sm:p-6">
              <h4 className="font-semibold text-amber-800 mb-2 text-sm sm:text-base">Understanding Budget Categories</h4>
              <ul className="text-xs sm:text-sm text-amber-700 space-y-1">
                <li><strong>Mandatory (65%):</strong> Required by law - Social Security, Medicare, Medicaid.</li>
                <li><strong>Discretionary (30%):</strong> Annual appropriation - defense, education, transportation.</li>
                <li><strong>Net Interest (5%):</strong> Interest on national debt. Growing rapidly.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'debt' && debt && (
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Total National Debt</p>
                <p className="text-lg sm:text-3xl font-bold text-red-600 mt-1 sm:mt-2">{debt.totalDebt_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">FY {debt.fiscal_year}</p>
                {debt.debtYoyChange !== 0 && (
                  <p className="text-xs sm:text-sm text-red-600 mt-1 sm:mt-2">
                    ↑ {(debt.debtYoyChange * 100).toFixed(1)}%
                  </p>
                )}n              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Debt-to-GDP Ratio</p>
                <p className={`text-lg sm:text-3xl font-bold mt-1 sm:mt-2 ${debt.debtToGdp > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                  {debt.debtToGdp.toFixed(1)}%
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">GDP: {debt.gdp_formatted}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Interest Payments</p>
                <p className="text-lg sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{debt.interestPayment_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{debt.interestToRevenue.toFixed(1)}% of revenue</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Debt Per Citizen</p>
                <p className="text-lg sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{debt.debtPerCapita_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Per capita share</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Debt vs GDP Trend</h3>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 text-xs sm:text-sm">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-red-600 rounded"></span> Total Debt</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded"></span> GDP</span>
                </div>
                {debtTrend && <DebtTrendChart data={debtTrend.years} />}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Debt-to-GDP Ratio Trend</h3>
                <p className="text-xs sm:text-sm text-gray-500 mb-2">Above 100% = Debt exceeds economic output</p>
                {debtTrend && <DebtToGdpChart data={debtTrend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Debt Breakdown - FY {debt.fiscal_year}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2 sm:mb-3 text-sm sm:text-base">By Holder</h4>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-xs sm:text-sm">Debt Held by Public</p>
                        <p className="text-[10px] sm:text-sm text-gray-500">Foreign governments, investors, Fed</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">{debt.publicDebt_formatted}</p>
                        <p className="text-[10px] sm:text-sm text-gray-500">{((debt.publicDebt / debt.totalDebt) * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900 text-xs sm:text-sm">Intragov Holdings</p>
                        <p className="text-[10px] sm:text-sm text-gray-500">Social Security trust fund, etc.</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-xs sm:text-sm">{debt.intragovDebt_formatted}</p>
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

        {activeTab === 'workforce' && workforce && (
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Federal Employees</p>
                <p className="text-lg sm:text-3xl font-bold text-purple-600 mt-1 sm:mt-2">{workforce.totalEmployees_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">FY {workforce.fiscal_year}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Personnel Cost</p>
                <p className="text-lg sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{workforce.totalCompensation_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Salaries & benefits</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Avg. Salary</p>
                <p className="text-lg sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">${workforce.avgSalaryAll.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">All agencies</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Contractors</p>
                <p className="text-lg sm:text-3xl font-bold text-amber-600 mt-1 sm:mt-2">{workforce.contractorSpending_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">~{workforce.contractorFTE_formatted} FTEs</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Employees by Agency - FY {workforce.fiscal_year}</h3>
                <WorkforceChart agencies={workforce.agencies} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Federal vs Contractor Trend</h3>
                <div className="flex flex-wrap gap-2 sm:gap-4 mb-2 text-xs sm:text-sm">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-600 rounded"></span> Federal</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 sm:w-3 sm:h-3 bg-amber-500 rounded"></span> Contractors</span>
                </div>
                {workforceTrend && <WorkforceTrendChart data={workforceTrend.years} />}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Federal Workforce by Agency - FY {workforce.fiscal_year}</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Employees</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Avg Salary</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Total Comp</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">% of WF</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {workforce.agencies.map((agency, idx) => (
                      <tr key={agency.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-gray-900 text-xs sm:text-sm">{agency.name.replace('Department of ', '').substring(0, 15)}{agency.name.replace('Department of ', '').length > 15 ? '...' : ''}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm">{agency.employees_formatted}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm hidden sm:table-cell">{agency.avg_salary_formatted}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm hidden md:table-cell">{agency.total_compensation_formatted}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm hidden sm:table-cell">{agency.percent_of_total.toFixed(1)}%</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">
                          <span className={`text-xs sm:text-sm ${agency.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {agency.yoy_change >= 0 ? '+' : ''}{(agency.yoy_change * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 sm:p-6">
              <h4 className="font-semibold text-purple-800 mb-2 text-sm sm:text-base">Understanding the Federal Workforce</h4>
              <ul className="text-xs sm:text-sm text-purple-700 space-y-1">
                <li><strong>Civilian only:</strong> Active duty military (~1.3M) is separate.</li>
                <li><strong>Contractors outnumber feds:</strong> ~2+ contractor workers per fed.</li>
                <li><strong>VA fastest growing:</strong> Veteran healthcare needs increasing.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'contracts' && contracts && (
          <div className="space-y-4 sm:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Contract Spending</p>
                <p className="text-lg sm:text-3xl font-bold text-orange-600 mt-1 sm:mt-2">{contracts.totalContracts_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">FY {contracts.fiscal_year}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Federal Grants</p>
                <p className="text-lg sm:text-3xl font-bold text-green-600 mt-1 sm:mt-2">{contracts.totalGrants_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">To states & orgs</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Top 10 Contractors</p>
                <p className="text-lg sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{contracts.topContractorTotal_formatted}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{((contracts.topContractorTotal / contracts.totalContracts) * 100).toFixed(0)}% of contracts</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Competed</p>
                <p className="text-lg sm:text-3xl font-bold text-blue-600 mt-1 sm:mt-2">{contracts.competition.competed}%</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Sole: {contracts.competition.sole_source}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Top Contractors - FY {contracts.fiscal_year}</h3>
                <TopContractorsChart contractors={contracts.contractors} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Contract Spending by Category</h3>
                <ContractCategoryChart categories={contracts.categories} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Federal Grants by Category</h3>
                <GrantsCategoryChart grants={contracts.grants} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Contract Competition Rate</h3>
                <div className="space-y-3 sm:space-y-4 mt-4 sm:mt-6">
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-600">Competed (Full & Open)</span>
                      <span className="font-medium">{contracts.competition.competed}%</span>
                    </div>
                    <div className="h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${contracts.competition.competed}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-600">Sole Source / No Competition</span>
                      <span className="font-medium">{contracts.competition.sole_source}%</span>
                    </div>
                    <div className="h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${contracts.competition.sole_source}%` }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="text-gray-600">Other (Limited, Set-aside)</span>
                      <span className="font-medium">{contracts.competition.other}%</span>
                    </div>
                    <div className="h-3 sm:h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${contracts.competition.other}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Top 10 Federal Contractors - FY {contracts.fiscal_year}</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Contractor</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Sector</th>
                      <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {contracts.contractors.map((contractor, idx) => (
                      <tr key={contractor.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm">#{idx + 1}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-gray-900 text-xs sm:text-sm">{contractor.name.substring(0, 12)}{contractor.name.length > 12 ? '...' : ''}</td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                            contractor.sector === 'Defense' ? 'bg-blue-100 text-blue-800' :
                            contractor.sector === 'Healthcare' ? 'bg-green-100 text-green-800' :
                            contractor.sector === 'IT Services' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {contractor.sector}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm">{contractor.amount_formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 sm:p-6">
              <h4 className="font-semibold text-orange-800 mb-2 text-sm sm:text-base">Understanding Federal Procurement</h4>
              <ul className="text-xs sm:text-sm text-orange-700 space-y-1">
                <li><strong>Defense dominates:</strong> Top 5 contractors are defense companies.</li>
                <li><strong>Competition saves:</strong> Competed contracts cost 15-20% less.</li>
                <li><strong>Grants vs Contracts:</strong> Grants to states/nonprofits; contracts buy goods.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'agencies' && agencies && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">All Federal Agencies - FY {selectedYear}</h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Outlays</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">% of Total</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">YoY Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {agencies.agencies.map((agency, idx) => (
                    <tr key={agency.code} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <span className="font-medium text-gray-900 text-xs sm:text-sm">{agency.name.replace('Department of ', '').substring(0, 20)}{agency.name.replace('Department of ', '').length > 20 ? '...' : ''}</span>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-900 text-xs sm:text-sm">{agency.outlays_formatted}</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-500 text-xs sm:text-sm hidden sm:table-cell">{agency.percent_of_total.toFixed(1)}%</td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                        <span className={`text-xs sm:text-sm ${agency.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-4">Interactive Spending Map - FY {selectedYear}</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">Tap/hover a state to see details</p>
              <USMap states={states.states} />
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">State-by-State Spending - FY {selectedYear}</h3>
              <StateTable states={states.states} />
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <p className="text-xs sm:text-sm text-gray-500 text-center">
            Data sourced from USAspending.gov | Built for transparency
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
