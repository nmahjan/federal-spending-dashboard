# Federal Spending Analytics Dashboard

A full-stack analytics dashboard for visualizing U.S. federal spending data.

## Features
- National Overview with year-over-year trends
- Agency Analysis with charts
- Interactive US Map with state spending data
- 6-year spending trend (FY 2020-2025)

## Tech Stack
- **Backend**: Python, Flask, SQLite
- **Frontend**: React, Vite, Tailwind CSS, Recharts, react-simple-maps

## Quick Start

### Backend
```bash
pip install flask flask-cors
python scripts/load_data.py --sample
python backend/app.py  # Runs on http://localhost:5002
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173
```

## API Endpoints
- `GET /api/overview` - National spending overview
- `GET /api/agencies` - Agency spending data
- `GET /api/states` - State spending data with map visualization

## Data Source
Sample data modeled after USAspending.gov

