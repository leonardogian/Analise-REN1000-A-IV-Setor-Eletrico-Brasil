#!/bin/bash
set -e

echo "Gerando dashboard JSON files..."
python3 -m src.analysis.build_dashboard_data
python3 -m src.analysis.dashboard_transgressoes

echo "Iniciando backend..."
exec uvicorn app.backend.main:app --host 0.0.0.0 --port "${PORT:-8051}"
