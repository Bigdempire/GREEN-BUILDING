# EcoBuild Project

## Run locally

This project now includes a Python Flask backend with SQLite data storage.

### Install dependencies

From the project root run:

```powershell
python -m pip install -r requirements.txt
```

### Start the backend server

Run:

```powershell
python app.py
```

Then open:

```text
http://localhost:5000/
```

The backend will create `ecobuild.db` automatically and initialize sample product data from `data/materials.json`.

## Database migration helper

If you already have an existing `ecobuild.db` file and want to apply schema updates, run:

```powershell
python migrate_db.py
```

This script will create a backup copy at `ecobuild.db.bak` and add any missing product columns such as `supplier_id` and `status`.

## API specification

An OpenAPI definition is available in `openapi.yaml` for inspection or API client generation.

## Entry point

Open `http://localhost:5000/` in your browser. Use the login page to authenticate buyers, suppliers, or admin users.

## New backend integration

- Added `app.py` for Flask API routes and SQLite storage
- Added `requirements.txt` for Python dependencies
- Updated signup, login, buyer, supplier, compare, calculator, and admin pages to use API calls
- Added shared responsive styling in `style.css`
- Added `auth.js` for form-based authentication and session management
- Products are now loaded from `/api/products` and metrics from `/api/metrics`
