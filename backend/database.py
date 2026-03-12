"""
Database schema and helpers for Federal Spending Dashboard
"""
import sqlite3
import logging
from pathlib import Path
from contextlib import contextmanager
from .config import Config

logger = logging.getLogger(__name__)

SCHEMA = """
-- Agency spending by fiscal year
CREATE TABLE IF NOT EXISTS agency_spending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    agency_code TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    total_obligations REAL DEFAULT 0,
    total_outlays REAL DEFAULT 0,
    budget_authority REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fiscal_year, agency_code)
);

-- State spending by fiscal year  
CREATE TABLE IF NOT EXISTS state_spending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    state_code TEXT NOT NULL,
    state_name TEXT NOT NULL,
    total_obligations REAL DEFAULT 0,
    total_outlays REAL DEFAULT 0,
    population INTEGER DEFAULT 0,
    per_capita REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fiscal_year, state_code)
);

-- Spending by state and agency (for drill-downs)
CREATE TABLE IF NOT EXISTS state_agency_spending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    state_code TEXT NOT NULL,
    agency_code TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    total_obligations REAL DEFAULT 0,
    total_outlays REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fiscal_year, state_code, agency_code)
);

-- Budget function categories
CREATE TABLE IF NOT EXISTS category_spending (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    category_code TEXT NOT NULL,
    category_name TEXT NOT NULL,
    total_outlays REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fiscal_year, category_code)
);

-- Summary cache for pre-computed aggregations
CREATE TABLE IF NOT EXISTS summary_cache (
    cache_key TEXT PRIMARY KEY,
    cache_value TEXT NOT NULL,
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Data pipeline metadata
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_type TEXT NOT NULL,
    fiscal_year INTEGER,
    status TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agency_year ON agency_spending(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_state_year ON state_spending(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_state_code ON state_spending(state_code);
CREATE INDEX IF NOT EXISTS idx_state_agency_state ON state_agency_spending(state_code, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_state_agency_agency ON state_agency_spending(agency_code, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_category_year ON category_spending(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON summary_cache(expires_at);
"""


def get_db_path() -> Path:
    """Get database path, creating directory if needed."""
    db_path = Path(Config.DATABASE_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


@contextmanager
def get_connection():
    """Context manager for database connections."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def init_database():
    """Initialize database with schema."""
    logger.info(f"Initializing database at {get_db_path()}")
    with get_connection() as conn:
        conn.executescript(SCHEMA)
    logger.info("Database initialized successfully")


def clear_table(table_name: str, fiscal_year: int = None):
    """Clear data from a table, optionally for specific fiscal year."""
    with get_connection() as conn:
        if fiscal_year:
            conn.execute(f"DELETE FROM {table_name} WHERE fiscal_year = ?", (fiscal_year,))
            logger.info(f"Cleared {table_name} for FY{fiscal_year}")
        else:
            conn.execute(f"DELETE FROM {table_name}")
            logger.info(f"Cleared all data from {table_name}")


def get_table_counts() -> dict:
    """Get record counts for all tables."""
    tables = ['agency_spending', 'state_spending', 'state_agency_spending', 
              'category_spending', 'pipeline_runs']
    counts = {}
    with get_connection() as conn:
        for table in tables:
            result = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}").fetchone()
            counts[table] = result['cnt']
    return counts


def log_pipeline_run(run_type: str, fiscal_year: int = None, status: str = "started", 
                     records: int = 0, error: str = None) -> int:
    """Log a pipeline run and return its ID."""
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO pipeline_runs (run_type, fiscal_year, status, records_processed, error_message)
               VALUES (?, ?, ?, ?, ?)""",
            (run_type, fiscal_year, status, records, error)
        )
        return cursor.lastrowid


def update_pipeline_run(run_id: int, status: str, records: int = 0, error: str = None):
    """Update a pipeline run status."""
    with get_connection() as conn:
        conn.execute(
            """UPDATE pipeline_runs 
               SET status = ?, records_processed = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (status, records, error, run_id)
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_database()
    print("Database tables:", get_table_counts())
