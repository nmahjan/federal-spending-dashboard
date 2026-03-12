"""
Data aggregation service for Federal Spending Dashboard
"""
import json
from datetime import datetime, timedelta
from ..database import get_connection
from ..config import Config
from .formatting import (
    format_currency, format_percent, format_change,
    calculate_yoy_change, rows_to_list
)


def get_cached(cache_key: str) -> dict:
    """Get cached value if not expired."""
    with get_connection() as conn:
        row = conn.execute(
            """SELECT cache_value FROM summary_cache 
               WHERE cache_key = ? AND expires_at > datetime('now')""",
            (cache_key,)
        ).fetchone()
        if row:
            return json.loads(row['cache_value'])
    return None


def set_cached(cache_key: str, value: dict):
    """Store value in cache."""
    expires = datetime.now() + timedelta(seconds=Config.CACHE_TTL_SECONDS)
    with get_connection() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO summary_cache (cache_key, cache_value, expires_at)
               VALUES (?, ?, ?)""",
            (cache_key, json.dumps(value), expires.isoformat())
        )


def get_national_overview(fiscal_year: int = None) -> dict:
    """Get national spending overview for a fiscal year."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    cache_key = f"overview_{fiscal_year}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    with get_connection() as conn:
        # Total spending for current year
        current = conn.execute(
            """SELECT SUM(total_outlays) as total, COUNT(*) as agency_count
               FROM agency_spending WHERE fiscal_year = ?""",
            (fiscal_year,)
        ).fetchone()
        
        # Previous year for YoY
        previous = conn.execute(
            """SELECT SUM(total_outlays) as total
               FROM agency_spending WHERE fiscal_year = ?""",
            (fiscal_year - 1,)
        ).fetchone()
        
        # Top 5 agencies
        top_agencies = conn.execute(
            """SELECT agency_code, agency_name, total_outlays
               FROM agency_spending 
               WHERE fiscal_year = ?
               ORDER BY total_outlays DESC
               LIMIT 5""",
            (fiscal_year,)
        ).fetchall()
    
    total = current['total'] or 0
    prev_total = previous['total'] if previous else 0
    yoy_change = calculate_yoy_change(total, prev_total)
    
    result = {
        'fiscal_year': fiscal_year,
        'total_outlays': total,
        'total_outlays_formatted': format_currency(total),
        'year_over_year_change': yoy_change,
        'year_over_year_formatted': format_change(yoy_change),
        'agency_count': current['agency_count'] or 0,
        'top_agencies': [
            {
                'code': row['agency_code'],
                'name': row['agency_name'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays']),
                'percent': (row['total_outlays'] / total * 100) if total > 0 else 0
            }
            for row in top_agencies
        ]
    }
    
    set_cached(cache_key, result)
    return result


def get_spending_trend(years: int = 6) -> dict:
    """Get historical spending trend."""
    end_year = Config.FISCAL_YEAR_MAX
    start_year = max(Config.FISCAL_YEAR_MIN, end_year - years + 1)
    
    cache_key = f"trend_{start_year}_{end_year}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT fiscal_year, SUM(total_outlays) as total
               FROM agency_spending 
               WHERE fiscal_year BETWEEN ? AND ?
               GROUP BY fiscal_year
               ORDER BY fiscal_year""",
            (start_year, end_year)
        ).fetchall()
    
    result = {
        'years': [
            {
                'fiscal_year': row['fiscal_year'],
                'total_outlays': row['total'],
                'total_outlays_formatted': format_currency(row['total'])
            }
            for row in rows
        ]
    }
    
    set_cached(cache_key, result)
    return result


def get_all_agencies(fiscal_year: int = None) -> dict:
    """Get all agencies with spending for a fiscal year."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    with get_connection() as conn:
        # Get total for percentage calculation
        total_row = conn.execute(
            "SELECT SUM(total_outlays) as total FROM agency_spending WHERE fiscal_year = ?",
            (fiscal_year,)
        ).fetchone()
        total = total_row['total'] or 1
        
        # Get all agencies
        agencies = conn.execute(
            """SELECT a.agency_code, a.agency_name, a.total_obligations, 
                      a.total_outlays, a.budget_authority,
                      p.total_outlays as prev_outlays
               FROM agency_spending a
               LEFT JOIN agency_spending p ON a.agency_code = p.agency_code 
                    AND p.fiscal_year = ?
               WHERE a.fiscal_year = ?
               ORDER BY a.total_outlays DESC""",
            (fiscal_year - 1, fiscal_year)
        ).fetchall()
    
    return {
        'fiscal_year': fiscal_year,
        'total_outlays': total,
        'agencies': [
            {
                'code': row['agency_code'],
                'name': row['agency_name'],
                'obligations': row['total_obligations'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays']),
                'budget_authority': row['budget_authority'],
                'percent_of_total': (row['total_outlays'] / total * 100) if total > 0 else 0,
                'yoy_change': calculate_yoy_change(row['total_outlays'], row['prev_outlays'])
            }
            for row in agencies
        ]
    }


def get_agency_detail(agency_code: str, fiscal_year: int = None) -> dict:
    """Get detailed info for a specific agency."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    with get_connection() as conn:
        # Current year data
        agency = conn.execute(
            """SELECT * FROM agency_spending 
               WHERE agency_code = ? AND fiscal_year = ?""",
            (agency_code, fiscal_year)
        ).fetchone()
        
        if not agency:
            return None
        
        # Historical data
        history = conn.execute(
            """SELECT fiscal_year, total_outlays
               FROM agency_spending 
               WHERE agency_code = ?
               ORDER BY fiscal_year""",
            (agency_code,)
        ).fetchall()
        
        # Top states for this agency (if data exists)
        top_states = conn.execute(
            """SELECT state_code, total_outlays
               FROM state_agency_spending
               WHERE agency_code = ? AND fiscal_year = ?
               ORDER BY total_outlays DESC
               LIMIT 10""",
            (agency_code, fiscal_year)
        ).fetchall()
    
    return {
        'code': agency['agency_code'],
        'name': agency['agency_name'],
        'fiscal_year': fiscal_year,
        'obligations': agency['total_obligations'],
        'outlays': agency['total_outlays'],
        'outlays_formatted': format_currency(agency['total_outlays']),
        'budget_authority': agency['budget_authority'],
        'history': [
            {
                'fiscal_year': row['fiscal_year'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays'])
            }
            for row in history
        ],
        'top_states': [
            {
                'state': row['state_code'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays'])
            }
            for row in top_states
        ]
    }


def get_all_states(fiscal_year: int = None) -> dict:
    """Get all states with spending data."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    with get_connection() as conn:
        states = conn.execute(
            """SELECT state_code, state_name, total_obligations, total_outlays,
                      population, per_capita
               FROM state_spending 
               WHERE fiscal_year = ?
               ORDER BY total_outlays DESC""",
            (fiscal_year,)
        ).fetchall()
        
        # Total for percentage
        total = sum(row['total_outlays'] for row in states) or 1
    
    return {
        'fiscal_year': fiscal_year,
        'states': [
            {
                'code': row['state_code'],
                'name': row['state_name'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays']),
                'population': row['population'],
                'per_capita': row['per_capita'],
                'per_capita_formatted': f"${row['per_capita']:,.0f}" if row['per_capita'] else "$0",
                'percent_of_total': (row['total_outlays'] / total * 100) if total > 0 else 0
            }
            for row in states
        ]
    }


def get_state_detail(state_code: str, fiscal_year: int = None) -> dict:
    """Get detailed info for a specific state."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    state_code = state_code.upper()
    
    with get_connection() as conn:
        # Current year data
        state = conn.execute(
            """SELECT * FROM state_spending 
               WHERE state_code = ? AND fiscal_year = ?""",
            (state_code, fiscal_year)
        ).fetchone()
        
        if not state:
            return None
        
        # Historical data
        history = conn.execute(
            """SELECT fiscal_year, total_outlays, per_capita
               FROM state_spending 
               WHERE state_code = ?
               ORDER BY fiscal_year""",
            (state_code,)
        ).fetchall()
        
        # Top agencies in this state
        top_agencies = conn.execute(
            """SELECT agency_code, agency_name, total_outlays
               FROM state_agency_spending
               WHERE state_code = ? AND fiscal_year = ?
               ORDER BY total_outlays DESC
               LIMIT 10""",
            (state_code, fiscal_year)
        ).fetchall()
    
    return {
        'code': state['state_code'],
        'name': state['state_name'],
        'fiscal_year': fiscal_year,
        'outlays': state['total_outlays'],
        'outlays_formatted': format_currency(state['total_outlays']),
        'population': state['population'],
        'per_capita': state['per_capita'],
        'per_capita_formatted': f"${state['per_capita']:,.0f}" if state['per_capita'] else "$0",
        'history': [
            {
                'fiscal_year': row['fiscal_year'],
                'outlays': row['total_outlays'],
                'per_capita': row['per_capita']
            }
            for row in history
        ],
        'top_agencies': [
            {
                'code': row['agency_code'],
                'name': row['agency_name'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays'])
            }
            for row in top_agencies
        ]
    }


def compare_states(state_codes: list, fiscal_year: int = None) -> dict:
    """Compare multiple states."""
    if fiscal_year is None:
        fiscal_year = Config.FISCAL_YEAR_MAX
    
    state_codes = [s.upper() for s in state_codes]
    placeholders = ','.join('?' * len(state_codes))
    
    with get_connection() as conn:
        states = conn.execute(
            f"""SELECT state_code, state_name, total_outlays, population, per_capita
               FROM state_spending 
               WHERE state_code IN ({placeholders}) AND fiscal_year = ?
               ORDER BY total_outlays DESC""",
            state_codes + [fiscal_year]
        ).fetchall()
    
    return {
        'fiscal_year': fiscal_year,
        'comparison': [
            {
                'code': row['state_code'],
                'name': row['state_name'],
                'outlays': row['total_outlays'],
                'outlays_formatted': format_currency(row['total_outlays']),
                'population': row['population'],
                'per_capita': row['per_capita'],
                'per_capita_formatted': f"${row['per_capita']:,.0f}" if row['per_capita'] else "$0"
            }
            for row in states
        ]
    }


def get_data_metadata() -> dict:
    """Get metadata about available data."""
    with get_connection() as conn:
        # Get available fiscal years
        years = conn.execute(
            "SELECT DISTINCT fiscal_year FROM agency_spending ORDER BY fiscal_year"
        ).fetchall()
        
        # Get last pipeline run
        last_run = conn.execute(
            """SELECT * FROM pipeline_runs 
               WHERE status = 'completed'
               ORDER BY completed_at DESC LIMIT 1"""
        ).fetchone()
        
        # Get record counts
        agency_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM agency_spending"
        ).fetchone()['cnt']
        
        state_count = conn.execute(
            "SELECT COUNT(*) as cnt FROM state_spending"
        ).fetchone()['cnt']
    
    return {
        'available_years': [row['fiscal_year'] for row in years],
        'default_year': Config.FISCAL_YEAR_MAX,
        'last_updated': last_run['completed_at'] if last_run else None,
        'record_counts': {
            'agencies': agency_count,
            'states': state_count
        }
    }
