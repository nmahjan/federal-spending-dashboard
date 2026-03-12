"""
Data Loading Pipeline for Federal Spending Dashboard

Loads raw JSON data from data/raw/ into SQLite database.
"""
import os
import sys
import json
import logging
from pathlib import Path
from datetime import datetime
from glob import glob

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import Config, RAW_DATA_DIR
from backend.database import (
    init_database, get_connection, clear_table,
    log_pipeline_run, update_pipeline_run, get_table_counts
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_latest_files() -> dict:
    """Find the most recent downloaded files for each category."""
    files = {}
    
    for category in ['agencies', 'geographic', 'categories']:
        pattern = str(RAW_DATA_DIR / f"{category}_*.json")
        matching = sorted(glob(pattern), reverse=True)
        if matching:
            # Group by fiscal year
            by_year = {}
            for filepath in matching:
                filename = Path(filepath).name
                # Extract fiscal year from filename like agencies_fy2025_20260309.json
                parts = filename.split('_')
                for part in parts:
                    if part.startswith('fy') and part[2:].isdigit():
                        fy = int(part[2:])
                        if fy not in by_year:
                            by_year[fy] = filepath
                        break
            files[category] = by_year
    
    return files


def load_agencies(filepath: str, fiscal_year: int) -> int:
    """Load agency data into database."""
    logger.info(f"Loading agencies from {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Handle both list format and dict with 'results' key
    if isinstance(data, dict):
        agencies = data.get('results', data.get('agencies', []))
    else:
        agencies = data
    
    records = 0
    with get_connection() as conn:
        for agency in agencies:
            try:
                # Map API fields to our schema
                conn.execute("""
                    INSERT OR REPLACE INTO agency_spending 
                    (fiscal_year, agency_code, agency_name, total_obligations, total_outlays, budget_authority)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    fiscal_year,
                    agency.get('toptier_code', agency.get('agency_code', 'UNK')),
                    agency.get('agency_name', agency.get('toptier_agency_name', 'Unknown')),
                    float(agency.get('obligated_amount', agency.get('total_obligations', 0)) or 0),
                    float(agency.get('outlay_amount', agency.get('total_outlays', 0)) or 0),
                    float(agency.get('budget_authority_amount', agency.get('budget_authority', 0)) or 0)
                ))
                records += 1
            except Exception as e:
                logger.warning(f"Failed to load agency: {agency.get('agency_name', 'Unknown')}: {e}")
    
    logger.info(f"Loaded {records} agencies for FY{fiscal_year}")
    return records


def load_geographic(filepath: str, fiscal_year: int) -> int:
    """Load geographic/state spending data into database."""
    logger.info(f"Loading geographic data from {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    results = data.get('results', [])
    
    records = 0
    with get_connection() as conn:
        for item in results:
            try:
                state_code = item.get('shape_code', item.get('state_code', ''))
                
                # Skip non-state entries
                if not state_code or len(state_code) != 2:
                    continue
                
                state_name = Config.STATE_NAMES.get(state_code, item.get('display_name', state_code))
                
                conn.execute("""
                    INSERT OR REPLACE INTO state_spending 
                    (fiscal_year, state_code, state_name, total_obligations, total_outlays, population, per_capita)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    fiscal_year,
                    state_code,
                    state_name,
                    float(item.get('aggregated_amount', item.get('total_obligations', 0)) or 0),
                    float(item.get('aggregated_amount', item.get('total_outlays', 0)) or 0),  # Same for now
                    int(item.get('population', 0) or 0),
                    float(item.get('per_capita', 0) or 0)
                ))
                records += 1
            except Exception as e:
                logger.warning(f"Failed to load state {item.get('shape_code', 'Unknown')}: {e}")
    
    logger.info(f"Loaded {records} states for FY{fiscal_year}")
    return records


def load_categories(filepath: str, fiscal_year: int) -> int:
    """Load budget category data into database."""
    logger.info(f"Loading categories from {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    results = data.get('results', [])
    
    records = 0
    with get_connection() as conn:
        for item in results:
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO category_spending 
                    (fiscal_year, category_code, category_name, total_outlays)
                    VALUES (?, ?, ?, ?)
                """, (
                    fiscal_year,
                    item.get('id', item.get('category_code', str(records))),
                    item.get('name', item.get('category_name', 'Unknown')),
                    float(item.get('amount', item.get('total_outlays', 0)) or 0)
                ))
                records += 1
            except Exception as e:
                logger.warning(f"Failed to load category: {e}")
    
    logger.info(f"Loaded {records} categories for FY{fiscal_year}")
    return records


def load_all_data(fiscal_years: list = None):
    """
    Load all downloaded data into database.
    
    Args:
        fiscal_years: List of years to load. None = load all available.
    """
    # Initialize database
    init_database()
    
    # Find available files
    files = find_latest_files()
    
    if not files:
        logger.error("No data files found in data/raw/. Run download_data.py first.")
        return
    
    logger.info(f"Found files: {list(files.keys())}")
    
    # Determine fiscal years to process
    available_years = set()
    for category_files in files.values():
        available_years.update(category_files.keys())
    
    if fiscal_years:
        years_to_load = [y for y in fiscal_years if y in available_years]
    else:
        years_to_load = sorted(available_years)
    
    logger.info(f"Loading data for fiscal years: {years_to_load}")
    
    total_records = 0
    
    for fy in years_to_load:
        run_id = log_pipeline_run('load', fy, 'started')
        fy_records = 0
        
        try:
            # Clear existing data for this fiscal year
            for table in ['agency_spending', 'state_spending', 'category_spending']:
                clear_table(table, fy)
            
            # Load agencies
            if 'agencies' in files and fy in files['agencies']:
                fy_records += load_agencies(files['agencies'][fy], fy)
            
            # Load geographic/state data
            if 'geographic' in files and fy in files['geographic']:
                fy_records += load_geographic(files['geographic'][fy], fy)
            
            # Load categories
            if 'categories' in files and fy in files['categories']:
                fy_records += load_categories(files['categories'][fy], fy)
            
            update_pipeline_run(run_id, 'completed', fy_records)
            logger.info(f"FY{fy}: Loaded {fy_records} total records")
            
        except Exception as e:
            logger.error(f"Failed to load FY{fy}: {e}")
            update_pipeline_run(run_id, 'failed', fy_records, str(e))
        
        total_records += fy_records
    
    # Print summary
    logger.info("\n" + "="*50)
    logger.info("LOAD COMPLETE")
    logger.info("="*50)
    counts = get_table_counts()
    for table, count in counts.items():
        logger.info(f"{table}: {count} records")
    
    return total_records


def load_sample_data():
    """
    Load sample/mock data for development when API data isn't available.
    """
    logger.info("Loading sample data for development...")
    
    init_database()
    
    # Sample agencies
    sample_agencies = [
        ('075', 'Department of Health and Human Services', 1.72e12, 1.68e12, 1.85e12),
        ('028', 'Social Security Administration', 1.42e12, 1.40e12, 1.45e12),
        ('097', 'Department of Defense', 886e9, 820e9, 900e9),
        ('020', 'Department of the Treasury', 520e9, 510e9, 550e9),
        ('036', 'Department of Veterans Affairs', 301e9, 295e9, 310e9),
        ('012', 'Department of Agriculture', 280e9, 275e9, 290e9),
        ('091', 'Department of Education', 238e9, 230e9, 250e9),
        ('069', 'Department of Transportation', 142e9, 138e9, 150e9),
        ('024', 'Department of Homeland Security', 98e9, 95e9, 105e9),
        ('015', 'Department of Justice', 42e9, 40e9, 45e9),
    ]
    
    # All 50 states + DC (code, name, base_spending, population)
    sample_states = [
        ('CA', 'California', 512e9, 39538223),
        ('TX', 'Texas', 398e9, 29145505),
        ('NY', 'New York', 342e9, 19453561),
        ('FL', 'Florida', 298e9, 21538187),
        ('PA', 'Pennsylvania', 201e9, 12801989),
        ('OH', 'Ohio', 175e9, 11799448),
        ('IL', 'Illinois', 168e9, 12671821),
        ('NC', 'North Carolina', 142e9, 10439388),
        ('MI', 'Michigan', 138e9, 10077331),
        ('GA', 'Georgia', 132e9, 10711908),
        ('NJ', 'New Jersey', 125e9, 9288994),
        ('VA', 'Virginia', 118e9, 8631393),
        ('WA', 'Washington', 105e9, 7614893),
        ('AZ', 'Arizona', 98e9, 7278717),
        ('MA', 'Massachusetts', 95e9, 7029917),
        ('TN', 'Tennessee', 89e9, 6910840),
        ('IN', 'Indiana', 85e9, 6785528),
        ('MO', 'Missouri', 82e9, 6154913),
        ('MD', 'Maryland', 80e9, 6177224),
        ('WI', 'Wisconsin', 76e9, 5893718),
        ('CO', 'Colorado', 74e9, 5773714),
        ('MN', 'Minnesota', 72e9, 5706494),
        ('SC', 'South Carolina', 68e9, 5118425),
        ('AL', 'Alabama', 65e9, 5024279),
        ('LA', 'Louisiana', 63e9, 4657757),
        ('KY', 'Kentucky', 60e9, 4505836),
        ('OR', 'Oregon', 56e9, 4237256),
        ('OK', 'Oklahoma', 52e9, 3959353),
        ('CT', 'Connecticut', 50e9, 3605944),
        ('UT', 'Utah', 42e9, 3271616),
        ('IA', 'Iowa', 41e9, 3190369),
        ('NV', 'Nevada', 40e9, 3104614),
        ('AR', 'Arkansas', 38e9, 3011524),
        ('MS', 'Mississippi', 37e9, 2961279),
        ('KS', 'Kansas', 36e9, 2937880),
        ('NM', 'New Mexico', 34e9, 2117522),
        ('NE', 'Nebraska', 28e9, 1961504),
        ('ID', 'Idaho', 24e9, 1839106),
        ('WV', 'West Virginia', 26e9, 1793716),
        ('HI', 'Hawaii', 22e9, 1455271),
        ('NH', 'New Hampshire', 18e9, 1377529),
        ('ME', 'Maine', 19e9, 1362359),
        ('RI', 'Rhode Island', 16e9, 1097379),
        ('MT', 'Montana', 15e9, 1084225),
        ('DE', 'Delaware', 14e9, 989948),
        ('SD', 'South Dakota', 13e9, 886667),
        ('ND', 'North Dakota', 12e9, 779094),
        ('AK', 'Alaska', 15e9, 733391),
        ('DC', 'District of Columbia', 45e9, 689545),
        ('VT', 'Vermont', 10e9, 643077),
        ('WY', 'Wyoming', 9e9, 576851),
    ]
    
    with get_connection() as conn:
        # Load sample agencies for 2020-2025
        for fy in range(2020, 2026):
            growth = 1 + (fy - 2020) * 0.03  # 3% annual growth
            covid_spike = 1.2 if fy in (2020, 2021) else 1.0  # COVID spending bump
            
            for code, name, oblig, outlay, budget in sample_agencies:
                conn.execute("""
                    INSERT OR REPLACE INTO agency_spending 
                    (fiscal_year, agency_code, agency_name, total_obligations, total_outlays, budget_authority)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (fy, code, name, oblig * growth * covid_spike, outlay * growth * covid_spike, budget * growth))
        
        # Load sample states for 2020-2025
        for fy in range(2020, 2026):
            growth = 1 + (fy - 2020) * 0.03
            covid_spike = 1.15 if fy in (2020, 2021) else 1.0
            
            for code, name, spending, pop in sample_states:
                per_cap = (spending * growth * covid_spike) / pop
                conn.execute("""
                    INSERT OR REPLACE INTO state_spending 
                    (fiscal_year, state_code, state_name, total_obligations, total_outlays, population, per_capita)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (fy, code, name, spending * growth * covid_spike, spending * growth * covid_spike, pop, per_cap))
    
    logger.info("Sample data loaded successfully")
    counts = get_table_counts()
    for table, count in counts.items():
        logger.info(f"{table}: {count} records")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Load federal spending data into database')
    parser.add_argument('--years', nargs='+', type=int, help='Specific fiscal years to load')
    parser.add_argument('--sample', action='store_true', help='Load sample development data')
    parser.add_argument('--clear', action='store_true', help='Clear all tables before loading')
    
    args = parser.parse_args()
    
    if args.clear:
        init_database()
        for table in ['agency_spending', 'state_spending', 'state_agency_spending', 'category_spending']:
            clear_table(table)
        logger.info("All tables cleared")
    
    if args.sample:
        load_sample_data()
    else:
        load_all_data(args.years)
