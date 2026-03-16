#!/usr/bin/env python3
"""Creates initial spending.json with baseline data"""
import json
from pathlib import Path

data = {
    "metadata": {
        "last_updated": "2026-03-15T17:00:00.000Z",
        "fiscal_years": [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
        "sources": ["USAspending.gov", "Treasury Fiscal Data API"],
        "note": "Initial file - will be updated monthly by GitHub Actions"
    },
    "debt": {
        "2019": {"totalDebt": 22.7e12, "publicDebt": 16.8e12},
        "2020": {"totalDebt": 27.7e12, "publicDebt": 21.0e12},
        "2021": {"totalDebt": 29.6e12, "publicDebt": 22.3e12},
        "2022": {"totalDebt": 31.4e12, "publicDebt": 24.3e12},
        "2023": {"totalDebt": 33.2e12, "publicDebt": 26.2e12},
        "2024": {"totalDebt": 35.0e12, "publicDebt": 27.8e12},
        "2025": {"totalDebt": 36.8e12, "publicDebt": 29.3e12},
        "2026": {"totalDebt": 38.5e12, "publicDebt": 30.8e12}
    },
    "gdp": {
        "2019": 21.4e12, "2020": 21.0e12, "2021": 23.0e12, "2022": 25.5e12,
        "2023": 27.4e12, "2024": 28.8e12, "2025": 30.0e12, "2026": 31.2e12
    },
    "agencies": {}
}

output_path = Path(__file__).parent.parent / "frontend" / "src" / "data" / "spending.json"
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"Created {output_path}")
