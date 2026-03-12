"""
Formatting helpers for Federal Spending Dashboard
"""


def format_currency(amount: float, short: bool = True) -> str:
    """
    Format a dollar amount for display.
    
    Args:
        amount: Dollar amount
        short: If True, use T/B/M suffixes
    
    Returns:
        Formatted string like "$6.13T" or "$6,130,000,000,000"
    """
    if amount is None:
        return "$0"
    
    if short:
        if abs(amount) >= 1e12:
            return f"${amount / 1e12:.2f}T"
        elif abs(amount) >= 1e9:
            return f"${amount / 1e9:.2f}B"
        elif abs(amount) >= 1e6:
            return f"${amount / 1e6:.2f}M"
        elif abs(amount) >= 1e3:
            return f"${amount / 1e3:.1f}K"
        else:
            return f"${amount:,.0f}"
    else:
        return f"${amount:,.0f}"


def format_percent(value: float, decimal_places: int = 1) -> str:
    """Format a decimal as percentage."""
    if value is None:
        return "0%"
    return f"{value * 100:.{decimal_places}f}%"


def format_change(value: float) -> str:
    """Format a change value with + or - prefix."""
    if value is None:
        return "0%"
    sign = "+" if value >= 0 else ""
    return f"{sign}{value * 100:.1f}%"


def calculate_yoy_change(current: float, previous: float) -> float:
    """Calculate year-over-year change as decimal."""
    if previous is None or previous == 0:
        return 0.0
    return (current - previous) / previous


def row_to_dict(row) -> dict:
    """Convert a sqlite3.Row to a dictionary."""
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows) -> list:
    """Convert sqlite3.Row objects to list of dicts."""
    return [dict(row) for row in rows]
