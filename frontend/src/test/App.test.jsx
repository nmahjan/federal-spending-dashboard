import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock react-simple-maps to avoid geography loading
vi.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }) => children,
  Geographies: ({ children }) => children({ geographies: [] }),
  Geography: () => null,
}))

import App from '../App'

describe('App Component', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('renders the dashboard header', () => {
    render(<App />)
    expect(screen.getByText('Federal Spending Analysis by Neil M.')).toBeInTheDocument()
  })
  
  it('renders all navigation tabs', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Revenue' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Budget' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Debt' })).toBeInTheDocument()
  })
  
  it('has overview tab selected by default', () => {
    render(<App />)
    const overviewTab = screen.getByRole('tab', { name: 'Overview' })
    expect(overviewTab).toHaveAttribute('aria-selected', 'true')
  })
  
  it('renders fiscal year selector', () => {
    render(<App />)
    expect(screen.getByLabelText('Select fiscal year')).toBeInTheDocument()
  })
  
  it('renders dark mode toggle button', () => {
    render(<App />)
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument()
  })
  
  it('renders skip link for accessibility', () => {
    render(<App />)
    expect(screen.getByText('Skip to main content')).toBeInTheDocument()
  })
  
  it('renders main content area with correct id', () => {
    render(<App />)
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })
})

describe('URL Parameters', () => {
  it('initializes from URL tab parameter', () => {
    window.history.replaceState({}, '', '/?tab=budget')
    render(<App />)
    const budgetTab = screen.getByRole('tab', { name: 'Budget' })
    expect(budgetTab).toHaveAttribute('aria-selected', 'true')
  })
  
  it('initializes from URL year parameter', () => {
    window.history.replaceState({}, '', '/?year=2020')
    render(<App />)
    const yearSelect = screen.getByLabelText('Select fiscal year')
    expect(yearSelect.value).toBe('2020')
  })
})
