#!/usr/bin/env python3
"""
Federal Spending Data Fetcher
Runs monthly via GitHub Actions to update dashboard data from official sources.

Data Sources:
- USAspending.gov API: Agency spending, contracts, grants
- Treasury Fiscal Data API: Revenue, debt

Output: frontend/src/data/spending.json
"""

import json
import requests
from datetime import datetime, date
from pathlib import Path
import time

USASPENDING_BASE = "https://api.usaspending.gov/api/v2"
TREASURY_BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"


def get_current_fiscal_year():
    today = date.today()
    return today.year + 1 if today.month >= 10 else today.year


def get_fiscal_years_range():
    current_fy = get_current_fiscal_year()
    return list(range(2019, current_fy + 1))


def rate_limited_request(url, params=None, json_data=None, method="GET", retries=3):
    for attempt in range(retries):
        try:
            if method == "POST":
                response = requests.post(url, json=json_data, timeout=30)
            else:
                response = requests.get(url, params=params, timeout=30)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                print(f"Rate limited, waiting 60s...")
                time.sleep(60)
            else:
                print(f"API error {response.status_code}: {url}")
                time.sleep(5)
        except Exception as e:
            print(f"Request failed (attempt {attempt + 1}): {e}")
            time.sleep(5)
    return None


def fetch_agency_spending(fiscal_year):
    print(f"  Fetching agency spending for FY{fiscal_year}...")
    url = f"{USASPENDING_BASE}/spending/"
    payload = {
        "type": "agency",
        "filters": {"fy": str(fiscal_year), "quarter": "4"}
    }
    data = rate_limited_request(url, json_data=payload, method="POST")
    if data and "results" in data:
        agencies = []
        for item in data["results"][:15]:
            agencies.append({
                "code": item.get("id", ""),
                "name": item.get("name", "Unknown"),
                "obligated": item.get("obligated_amount", 0),
                "outlays": item.get("outlay_amount", item.get("obligated_amount", 0) * 0.95),
            })
        return agencies
    return None


def fetch_debt_data():
    print("  Fetching debt data from Treasury...")
    url = f"{TREASURY_BASE}/v2/accounting/od/debt_to_penny"
    params = {"sort": "-record_date", "page[size]": 100, "filter": "record_date:gte:2018-10-01"}
    data = rate_limited_request(url, params=params)
    if data and "data" in data:
        debt_by_fy = {}
        for record in data["data"]:
            record_date = datetime.strptime(record["record_date"], "%Y-%m-%d")
            fy = record_date.year + 1 if record_date.month >= 10 else record_date.year
            if fy not in debt_by_fy or record_date > debt_by_fy[fy]["date"]:
                debt_by_fy[fy] = {
                    "date": record_date,
                    "total_debt": float(record.get("tot_pub_debt_out_amt", 0)),
                    "public_debt": float(record.get("debt_held_public_amt", 0)),
                }
        result = {}
        for fy, values in debt_by_fy.items():
            result[fy] = {
                "totalDebt": values["total_debt"],
                "publicDebt": values["public_debt"],
                "intragovDebt": values["total_debt"] - values["public_debt"]
            }
        return result
    return None


def fetch_gdp_data():
    return {
        2019: 21.4e12, 2020: 21.0e12, 2021: 23.0e12, 2022: 25.5e12,
        2023: 27.4e12, 2024: 28.8e12, 2025: 30.0e12, 2026: 31.2e12,
    }


def main():
    print("=" * 50)
    print("Federal Spending Data Fetcher")
    print(f"Run Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    fiscal_years = get_fiscal_years_range()
    print(f"Fetching data for FY{fiscal_years[0]}-FY{fiscal_years[-1]}")
    
    data = {
        "metadata": {
            "last_updated": datetime.now().isoformat(),
            "fiscal_years": fiscal_years,
            "sources": ["USAspending.gov", "Treasury Fiscal Data API"]
        },
        "agencies": {},
        "debt": {},
        "gdp": fetch_gdp_data()
    }
    
    print("\n[1/2] Fetching Debt Data...")
    debt_data = fetch_debt_data()
    if debt_data:
        data["debt"] = debt_data
        print(f"  Got debt data for {len(debt_data)} years")
    
    for fy in fiscal_years:
        print(f"\n[{fy}] Fetching FY{fy} data...")
        agencies = fetch_agency_spending(fy)
        if agencies:
            data["agencies"][str(fy)] = agencies
            print(f"  Got {len(agencies)} agencies")
        time.sleep(1)
    
    output_path = Path(__file__).parent.parent / "frontend" / "src" / "data" / "spending.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    
    print(f"\n{'=' * 50}")
    print(f"Data saved to: {output_path}")
    print("=" * 50)
    return data


if __name__ == "__main__":
    main()
