"""
Federal Spending Dashboard - Quick Start

Run this file to test the setup and see available commands.
"""
import sys
import os

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    print("=" * 60)
    print("FEDERAL SPENDING DASHBOARD")
    print("=" * 60)
    print()
    print("Available commands:")
    print()
    print("  1. Test API Connection:")
    print("     python scripts/download_data.py --test")
    print()
    print("  2. Download Data (all years 2020-2025):")
    print("     python scripts/download_data.py")
    print()
    print("  3. Download Latest Year Only:")
    print("     python scripts/download_data.py --latest")
    print()
    print("  4. Load Sample Data (for development):")
    print("     python scripts/load_data.py --sample")
    print()
    print("  5. Load Downloaded Data:")
    print("     python scripts/load_data.py")
    print()
    print("  6. Validate Data:")
    print("     python scripts/validate_data.py")
    print()
    print("  7. Initialize Database:")
    print("     python backend/database.py")
    print()
    print("  8. Start API Server (port 5002):")
    print("     PYTHONPATH=. python backend/app.py")
    print()
    print("  9. Start Frontend (port 5173/5174):")
    print("     cd frontend && npm run dev")
    print()
    print("=" * 60)
    print()
    
    # Test imports
    try:
        from backend.config import Config
        print(f"Config loaded: FY{Config.FISCAL_YEAR_MIN}-{Config.FISCAL_YEAR_MAX}")
    except ImportError as e:
        print(f"Config import failed: {e}")
    
    try:
        from backend.database import init_database, get_table_counts
        init_database()
        counts = get_table_counts()
        print("Database initialized")
        for table, count in counts.items():
            if count > 0:
                print(f"  - {table}: {count} records")
    except Exception as e:
        print(f"Database error: {e}")
    
    print()


if __name__ == "__main__":
    main()
