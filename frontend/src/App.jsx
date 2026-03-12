import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'

const API_BASE = 'http://localhost:5002/api'
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

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
  const [overview, setOverview] = useState(null)
  const [trend, setTrend] = useState(null)
  const [agencies, setAgencies] = useState(null)
  const [states, setStates] = useState(null)
  const [selectedYear, setSelectedYear] = useState(2025)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const [overviewRes, trendRes, agenciesRes, statesRes] = await Promise.all([
          fetch(`${API_BASE}/overview?year=${selectedYear}`),
          fetch(`${API_BASE}/overview/trend?years=6`),
          fetch(`${API_BASE}/agencies?year=${selectedYear}`),
          fetch(`${API_BASE}/states?year=${selectedYear}`)
        ])
        
        if (!overviewRes.ok) throw new Error('Failed to fetch overview')
        
        setOverview(await overviewRes.json())
        setTrend(await trendRes.json())
        setAgencies(await agenciesRes.json())
        setStates(await statesRes.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedYear])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading federal spending data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold">Error Loading Data</h2>
          <p className="text-red-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Make sure the API server is running on port 5002</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                {[2025, 2024, 2023, 2022, 2021, 2020].map(y => (
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Total Federal Spending" 
                value={overview.total_outlays_formatted}
                subtitle={`FY ${overview.fiscal_year}`}
                change={overview.year_over_year_change}
              />
              <StatCard 
                title="Number of Agencies" 
                value={overview.agency_count}
                subtitle="Major federal agencies"
              />
              <StatCard 
                title="Top Agency" 
                value={overview.top_agencies[0]?.outlays_formatted}
                subtitle={overview.top_agencies[0]?.name}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">6-Year Spending Trend</h3>
                {trend && <TrendChart data={trend.years} />}
              </div>
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Agencies</h3>
                <AgencyChart agencies={overview.top_agencies} />
              </div>
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
