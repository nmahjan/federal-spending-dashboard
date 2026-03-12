"""
Data Download Pipeline for Federal Spending Dashboard

Downloads spending data from USAspending.gov API for fiscal years 2020-2025.
Stores raw JSON responses in data/raw/ directory.

USAspending.gov API v2 Documentation:
https://api.usaspending.gov/docs/endpoints
"""
import os
import sys
import json
import time
import logging
import requests
from pathlib import Path
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import Config, DATA_DIR, RAW_DATA_DIR

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class USASpendingClient:
    """Client for USAspending.gov API v2."""
    
    def __init__(self):
        self.base_url = Config.USASPENDING_API_BASE
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, payload: dict = None) -> dict:
        """Make API request with retry logic."""
        url = f"{self.base_url}/{endpoint}"
        
        for attempt in range(Config.API_RETRY_ATTEMPTS):
            try:
                if method == 'GET':
                    response = self.session.get(url, timeout=Config.API_TIMEOUT)
                else:  # POST
                    response = self.session.post(url, json=payload, timeout=Config.API_TIMEOUT)
                
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request failed (attempt {attempt + 1}/{Config.API_RETRY_ATTEMPTS}): {e}")
                if attempt < Config.API_RETRY_ATTEMPTS - 1:
                    time.sleep(Config.API_RETRY_DELAY)
                else:
                    raise
    
    def get_agency_spending(self, fiscal_year: int) -> list:
        """
        Get spending by agency for a fiscal year.
        
        Uses: POST /api/v2/spending/agency/
        """
        logger.info(f"Fetching agency spending for FY{fiscal_year}")
        
        payload = {
            "fiscal_year": fiscal_year,
            "limit": 100,
            "page": 1,
            "sort": "obligated_amount",
            "order": "desc"
        }
        
        all_results = []
        
        while True:
            response = self._request('POST', 'references/toptier_agencies/', payload)
            results = response.get('results', [])
            
            if not results:
                break
                
            all_results.extend(results)
            
            # Check if there are more pages
            if len(results) < payload['limit']:
                break
            
            payload['page'] += 1
            time.sleep(0.5)  # Rate limiting
        
        logger.info(f"Retrieved {len(all_results)} agencies for FY{fiscal_year}")
        return all_results
    
    def get_state_spending(self, fiscal_year: int) -> list:
        """
        Get spending by state for a fiscal year.
        
        Uses: POST /api/v2/recipient/state/
        """
        logger.info(f"Fetching state spending for FY{fiscal_year}")
        
        all_results = []
        
        for state_code in Config.STATE_CODES:
            try:
                # Get state totals
                payload = {
                    "fiscal_year": fiscal_year,
                    "fips": state_code  # Note: API might need FIPS codes, not state abbrev
                }
                
                # Try the state awards endpoint
                endpoint = f"recipient/state/{state_code}/"
                response = self._request('GET', endpoint + f"?year={fiscal_year}")
                
                if response:
                    all_results.append({
                        'state_code': state_code,
                        'state_name': Config.STATE_NAMES.get(state_code, state_code),
                        'data': response
                    })
                
                time.sleep(0.3)  # Rate limiting
                
            except Exception as e:
                logger.warning(f"Failed to get data for {state_code}: {e}")
                continue
        
        logger.info(f"Retrieved data for {len(all_results)} states for FY{fiscal_year}")
        return all_results
    
    def get_spending_by_geography(self, fiscal_year: int) -> dict:
        """
        Get aggregated spending by state using the spending endpoint.
        
        Uses: POST /api/v2/search/spending_by_geography/
        """
        logger.info(f"Fetching geographic spending for FY{fiscal_year}")
        
        payload = {
            "scope": "place_of_performance",
            "geo_layer": "state",
            "filters": {
                "time_period": [
                    {
                        "start_date": f"{fiscal_year - 1}-10-01",
                        "end_date": f"{fiscal_year}-09-30"
                    }
                ]
            }
        }
        
        response = self._request('POST', 'search/spending_by_geography/', payload)
        return response
    
    def get_spending_by_category(self, fiscal_year: int, category: str = "federal_account") -> dict:
        """
        Get spending by budget category.
        
        Uses: POST /api/v2/search/spending_by_category/
        """
        logger.info(f"Fetching category spending for FY{fiscal_year}")
        
        payload = {
            "filters": {
                "time_period": [
                    {
                        "start_date": f"{fiscal_year - 1}-10-01", 
                        "end_date": f"{fiscal_year}-09-30"
                    }
                ]
            },
            "category": category,
            "limit": 100,
            "page": 1
        }
        
        response = self._request('POST', 'search/spending_by_category/', payload)
        return response


def save_raw_data(data: dict, filename: str):
    """Save raw API response to data/raw/ directory."""
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    filepath = RAW_DATA_DIR / filename
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, default=str)
    
    logger.info(f"Saved {filepath}")


def download_all_data(fiscal_years: list = None):
    """
    Download all spending data for specified fiscal years.
    
    Args:
        fiscal_years: List of years to download. Defaults to 2020-2025.
    """
    if fiscal_years is None:
        fiscal_years = list(range(Config.FISCAL_YEAR_MIN, Config.FISCAL_YEAR_MAX + 1))
    
    client = USASpendingClient()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    logger.info(f"Starting data download for fiscal years: {fiscal_years}")
    
    download_summary = {
        'started_at': timestamp,
        'fiscal_years': fiscal_years,
        'results': {}
    }
    
    for fy in fiscal_years:
        logger.info(f"\n{'='*50}\nProcessing FY{fy}\n{'='*50}")
        
        fy_results = {}
        
        # 1. Download agency data
        try:
            agencies = client.get_agency_spending(fy)
            save_raw_data(agencies, f"agencies_fy{fy}_{timestamp}.json")
            fy_results['agencies'] = len(agencies)
        except Exception as e:
            logger.error(f"Failed to download agency data for FY{fy}: {e}")
            fy_results['agencies'] = f"ERROR: {e}"
        
        # 2. Download geographic spending data
        try:
            geo_data = client.get_spending_by_geography(fy)
            save_raw_data(geo_data, f"geographic_fy{fy}_{timestamp}.json")
            fy_results['geographic'] = len(geo_data.get('results', []))
        except Exception as e:
            logger.error(f"Failed to download geographic data for FY{fy}: {e}")
            fy_results['geographic'] = f"ERROR: {e}"
        
        # 3. Download category spending data
        try:
            category_data = client.get_spending_by_category(fy)
            save_raw_data(category_data, f"categories_fy{fy}_{timestamp}.json")
            fy_results['categories'] = len(category_data.get('results', []))
        except Exception as e:
            logger.error(f"Failed to download category data for FY{fy}: {e}")
            fy_results['categories'] = f"ERROR: {e}"
        
        download_summary['results'][fy] = fy_results
        
        # Pause between fiscal years to avoid rate limiting
        time.sleep(2)
    
    # Save download summary
    download_summary['completed_at'] = datetime.now().strftime('%Y%m%d_%H%M%S')
    save_raw_data(download_summary, f"download_summary_{timestamp}.json")
    
    logger.info("\n" + "="*50)
    logger.info("DOWNLOAD COMPLETE")
    logger.info("="*50)
    for fy, results in download_summary['results'].items():
        logger.info(f"FY{fy}: {results}")
    
    return download_summary


def test_api_connection():
    """Test API connectivity with a simple request."""
    logger.info("Testing USAspending.gov API connection...")
    
    client = USASpendingClient()
    
    try:
        # Test with agencies endpoint (most reliable)
        response = client._request('GET', 'references/toptier_agencies/')
        logger.info(f"SUCCESS: API returned {len(response.get('results', []))} agencies")
        return True
    except Exception as e:
        logger.error(f"FAILED: {e}")
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Download federal spending data')
    parser.add_argument('--test', action='store_true', help='Test API connection only')
    parser.add_argument('--years', nargs='+', type=int, help='Specific fiscal years to download')
    parser.add_argument('--latest', action='store_true', help='Download only the latest fiscal year')
    
    args = parser.parse_args()
    
    if args.test:
        success = test_api_connection()
        sys.exit(0 if success else 1)
    elif args.latest:
        download_all_data([Config.FISCAL_YEAR_MAX])
    elif args.years:
        download_all_data(args.years)
    else:
        download_all_data()
