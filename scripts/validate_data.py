"""
Data Validation for Federal Spending Dashboard

Run after loading data to verify integrity.
"""
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import Config
from backend.database import get_connection, init_database

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ValidationResult:
    def __init__(self, name: str):
        self.name = name
        self.passed = False
        self.message = ""
        self.details = []


def check_agency_coverage(fiscal_year: int) -> ValidationResult:
    """Check if we have agency data for the fiscal year."""
    result = ValidationResult(f"Agency coverage FY{fiscal_year}")
    
    with get_connection() as conn:
        count = conn.execute(
            "SELECT COUNT(*) as cnt FROM agency_spending WHERE fiscal_year = ?",
            (fiscal_year,)
        ).fetchone()['cnt']
    
    if count >= 10:  # Expect at least 10 major agencies
        result.passed = True
        result.message = f"Found {count} agencies"
    else:
        result.message = f"Only {count} agencies found (expected >= 10)"
    
    return result


def check_state_coverage(fiscal_year: int) -> ValidationResult:
    """Check if we have all 50 states + DC."""
    result = ValidationResult(f"State coverage FY{fiscal_year}")
    
    with get_connection() as conn:
        count = conn.execute(
            "SELECT COUNT(DISTINCT state_code) as cnt FROM state_spending WHERE fiscal_year = ?",
            (fiscal_year,)
        ).fetchone()['cnt']
        
        missing = conn.execute("""
            SELECT code FROM (
                SELECT 'AL' as code UNION SELECT 'AK' UNION SELECT 'AZ' UNION SELECT 'AR'
                UNION SELECT 'CA' UNION SELECT 'CO' UNION SELECT 'CT' UNION SELECT 'DE'
                UNION SELECT 'FL' UNION SELECT 'GA' UNION SELECT 'HI' UNION SELECT 'ID'
                UNION SELECT 'IL' UNION SELECT 'IN' UNION SELECT 'IA' UNION SELECT 'KS'
                UNION SELECT 'KY' UNION SELECT 'LA' UNION SELECT 'ME' UNION SELECT 'MD'
                UNION SELECT 'MA' UNION SELECT 'MI' UNION SELECT 'MN' UNION SELECT 'MS'
                UNION SELECT 'MO' UNION SELECT 'MT' UNION SELECT 'NE' UNION SELECT 'NV'
                UNION SELECT 'NH' UNION SELECT 'NJ' UNION SELECT 'NM' UNION SELECT 'NY'
                UNION SELECT 'NC' UNION SELECT 'ND' UNION SELECT 'OH' UNION SELECT 'OK'
                UNION SELECT 'OR' UNION SELECT 'PA' UNION SELECT 'RI' UNION SELECT 'SC'
                UNION SELECT 'SD' UNION SELECT 'TN' UNION SELECT 'TX' UNION SELECT 'UT'
                UNION SELECT 'VT' UNION SELECT 'VA' UNION SELECT 'WA' UNION SELECT 'WV'
                UNION SELECT 'WI' UNION SELECT 'WY' UNION SELECT 'DC'
            ) 
            WHERE code NOT IN (
                SELECT state_code FROM state_spending WHERE fiscal_year = ?
            )
        """, (fiscal_year,)).fetchall()
    
    if count >= 50:
        result.passed = True
        result.message = f"Found {count} states/territories"
    else:
        result.message = f"Only {count} states found"
        result.details = [row['code'] for row in missing]
    
    return result


def check_positive_values(fiscal_year: int) -> ValidationResult:
    """Check for negative spending values (shouldn't exist)."""
    result = ValidationResult(f"Positive values FY{fiscal_year}")
    
    with get_connection() as conn:
        # Check agencies
        neg_agencies = conn.execute("""
            SELECT COUNT(*) as cnt FROM agency_spending 
            WHERE fiscal_year = ? AND (total_obligations < 0 OR total_outlays < 0)
        """, (fiscal_year,)).fetchone()['cnt']
        
        # Check states
        neg_states = conn.execute("""
            SELECT COUNT(*) as cnt FROM state_spending 
            WHERE fiscal_year = ? AND (total_obligations < 0 OR total_outlays < 0)
        """, (fiscal_year,)).fetchone()['cnt']
    
    total_neg = neg_agencies + neg_states
    
    if total_neg == 0:
        result.passed = True
        result.message = "No negative values found"
    else:
        result.message = f"Found {total_neg} negative values"
        result.details = [f"Agencies: {neg_agencies}", f"States: {neg_states}"]
    
    return result


def check_totals_reasonable(fiscal_year: int) -> ValidationResult:
    """Check if total spending is in reasonable range ($4T - $10T)."""
    result = ValidationResult(f"Total spending reasonable FY{fiscal_year}")
    
    with get_connection() as conn:
        total = conn.execute("""
            SELECT SUM(total_outlays) as total FROM agency_spending WHERE fiscal_year = ?
        """, (fiscal_year,)).fetchone()['total']
    
    if total is None:
        result.message = "No data found"
        return result
    
    total_t = total / 1e12  # Convert to trillions
    
    if 4.0 <= total_t <= 10.0:
        result.passed = True
        result.message = f"Total: ${total_t:.2f}T (reasonable range)"
    else:
        result.message = f"Total: ${total_t:.2f}T (outside expected $4T-$10T range)"
    
    return result


def check_per_capita_valid(fiscal_year: int) -> ValidationResult:
    """Check if per capita values are reasonable ($5K - $50K)."""
    result = ValidationResult(f"Per capita valid FY{fiscal_year}")
    
    with get_connection() as conn:
        invalid = conn.execute("""
            SELECT state_code, per_capita FROM state_spending 
            WHERE fiscal_year = ? AND population > 0 
            AND (per_capita < 5000 OR per_capita > 50000)
        """, (fiscal_year,)).fetchall()
    
    if len(invalid) == 0:
        result.passed = True
        result.message = "All per capita values in range"
    else:
        result.message = f"{len(invalid)} states with unusual per capita"
        result.details = [f"{row['state_code']}: ${row['per_capita']:,.0f}" for row in invalid[:5]]
    
    return result


def run_all_validations(fiscal_years: list = None) -> dict:
    """Run all validations for specified fiscal years."""
    
    if fiscal_years is None:
        fiscal_years = list(range(Config.FISCAL_YEAR_MIN, Config.FISCAL_YEAR_MAX + 1))
    
    all_results = {}
    checks = [
        check_agency_coverage,
        check_state_coverage,
        check_positive_values,
        check_totals_reasonable,
        check_per_capita_valid,
    ]
    
    for fy in fiscal_years:
        logger.info(f"\nValidating FY{fy}...")
        fy_results = []
        
        for check_func in checks:
            result = check_func(fy)
            fy_results.append(result)
            
            status = "✓" if result.passed else "✗"
            logger.info(f"  {status} {result.name}: {result.message}")
            if result.details:
                for detail in result.details[:3]:
                    logger.info(f"      - {detail}")
        
        all_results[fy] = fy_results
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("VALIDATION SUMMARY")
    logger.info("="*50)
    
    total_passed = 0
    total_failed = 0
    
    for fy, results in all_results.items():
        passed = sum(1 for r in results if r.passed)
        failed = len(results) - passed
        total_passed += passed
        total_failed += failed
        logger.info(f"FY{fy}: {passed}/{len(results)} checks passed")
    
    logger.info(f"\nOverall: {total_passed} passed, {total_failed} failed")
    
    return all_results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Validate loaded federal spending data')
    parser.add_argument('--years', nargs='+', type=int, help='Specific fiscal years to validate')
    
    args = parser.parse_args()
    
    init_database()
    results = run_all_validations(args.years)
    
    # Exit with error code if any validation failed
    all_passed = all(r.passed for fy_results in results.values() for r in fy_results)
    sys.exit(0 if all_passed else 1)
