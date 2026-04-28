#!/bin/bash
set -e

if [ ! -f "data/processed/dashboard/dashboard_data.json" ]; then
    echo "Gerando dashboard JSON files..."
    python3 -m src.analysis.build_dashboard_data
    python3 -m src.analysis.dashboard_transgressoes
else
    echo "Dashboard JSON files já existem, pulando geração..."
fi

echo "Iniciando backend..."
exec uvicorn app.backend.main:app --host 0.0.0.0 --port "${PORT:-8051}"
