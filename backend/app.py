"""
Federal Spending Dashboard - Flask API Server

Run with: python backend/app.py
Server runs on http://localhost:5002
"""
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask import Flask, jsonify, request
from flask_cors import CORS

from backend.database import init_database, get_connection
from backend.config import Config
from backend.services.aggregation import (
    get_national_overview,
    get_spending_trend,
    get_all_agencies,
    get_agency_detail,
    get_all_states,
    get_state_detail,
    compare_states,
    get_data_metadata
)

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175"])

# Initialize database on startup
init_database()


# ============================================================
# Health & Metadata Endpoints
# ============================================================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint for deployment monitoring."""
    return jsonify({
        'status': 'healthy',
        'service': 'federal-spending-api'
    })


@app.route('/api/metadata', methods=['GET'])
def metadata():
    """Get API metadata including available years and last update time."""
    try:
        data = get_data_metadata()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# National Overview Endpoints
# ============================================================

@app.route('/api/overview', methods=['GET'])
def overview():
    """
    Get national spending overview.
    
    Query params:
        year: Fiscal year (default: latest)
    """
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    try:
        data = get_national_overview(year)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/overview/trend', methods=['GET'])
def trend():
    """
    Get historical spending trend.
    
    Query params:
        years: Number of years to include (default: 6)
    """
    years = request.args.get('years', type=int, default=6)
    
    try:
        data = get_spending_trend(years)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# Agency Endpoints
# ============================================================

@app.route('/api/agencies', methods=['GET'])
def agencies():
    """
    Get all agencies with spending data.
    
    Query params:
        year: Fiscal year (default: latest)
    """
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    try:
        data = get_all_agencies(year)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/agencies/<agency_code>', methods=['GET'])
def agency_detail(agency_code: str):
    """
    Get detailed info for a specific agency.
    
    Query params:
        year: Fiscal year (default: latest)
    """
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    try:
        data = get_agency_detail(agency_code, year)
        if data is None:
            return jsonify({'error': f'Agency {agency_code} not found'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# State Endpoints
# ============================================================

@app.route('/api/states', methods=['GET'])
def states():
    """
    Get all states with spending data.
    
    Query params:
        year: Fiscal year (default: latest)
    """
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    try:
        data = get_all_states(year)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/states/compare', methods=['GET'])
def states_compare():
    """
    Compare multiple states.
    
    Query params:
        codes: Comma-separated state codes (e.g., CA,TX,NY)
        year: Fiscal year (default: latest)
    """
    codes_param = request.args.get('codes', '')
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    if not codes_param:
        return jsonify({'error': 'Missing required parameter: codes'}), 400
    
    codes = [c.strip().upper() for c in codes_param.split(',') if c.strip()]
    
    if len(codes) < 2:
        return jsonify({'error': 'At least 2 state codes required'}), 400
    
    if len(codes) > 10:
        return jsonify({'error': 'Maximum 10 states for comparison'}), 400
    
    try:
        data = compare_states(codes, year)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/states/<state_code>', methods=['GET'])
def state_detail(state_code: str):
    """
    Get detailed info for a specific state.
    
    Query params:
        year: Fiscal year (default: latest)
    """
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    # Validate state code
    state_code = state_code.upper()
    if state_code not in Config.STATE_CODES:
        return jsonify({'error': f'Invalid state code: {state_code}'}), 400
    
    try:
        data = get_state_detail(state_code, year)
        if data is None:
            return jsonify({'error': f'No data for state {state_code}'}), 404
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# Export Endpoint
# ============================================================

@app.route('/api/export', methods=['GET'])
def export_data():
    """
    Export data as JSON (CSV export can be added later).
    
    Query params:
        type: 'agencies' or 'states'
        year: Fiscal year (default: latest)
    """
    data_type = request.args.get('type', 'agencies')
    year = request.args.get('year', type=int, default=Config.FISCAL_YEAR_MAX)
    
    try:
        if data_type == 'agencies':
            data = get_all_agencies(year)
        elif data_type == 'states':
            data = get_all_states(year)
        else:
            return jsonify({'error': f'Invalid export type: {data_type}'}), 400
        
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# Error Handlers
# ============================================================

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================
# Main
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("FEDERAL SPENDING DASHBOARD API")
    print("=" * 60)
    print(f"Running on http://localhost:5002")
    print(f"Data for fiscal years: {Config.FISCAL_YEAR_MIN}-{Config.FISCAL_YEAR_MAX}")
    print()
    print("Endpoints:")
    print("  GET /api/health          - Health check")
    print("  GET /api/metadata        - Data metadata")
    print("  GET /api/overview        - National overview")
    print("  GET /api/overview/trend  - Historical trend")
    print("  GET /api/agencies        - All agencies")
    print("  GET /api/agencies/<code> - Agency detail")
    print("  GET /api/states          - All states")
    print("  GET /api/states/<code>   - State detail")
    print("  GET /api/states/compare  - Compare states")
    print("  GET /api/export          - Export data")
    print("=" * 60)
    
    app.run(debug=True, port=5002)
