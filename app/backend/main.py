"""FastAPI backend for local dashboard and data endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import os
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


load_dotenv()

ROOT = Path(__file__).resolve().parent.parent.parent
APP_DIR = ROOT / "app"
DASHBOARD_DIR = APP_DIR / "frontend"
DASHBOARD_JSON_PATH = DASHBOARD_DIR / "dashboard_data.json"
ANALYSIS_DIR = ROOT / "data" / "processed" / "analysis"
GROUPS_DIR = ANALYSIS_DIR / "grupos"

REQUIRED_JSON_KEYS = {
    "meta",
    "kpi_overview",
    "serie_anual",
    "serie_mensal_nacional",
    "distributor_groups",
    "group_views",
    "default_group_id",
    "featured_group_ids",
    "featured_groups",
    "featured_group_compare_anual",
    "featured_group_compare_latest",
    "regulatory_groups",
    "regulatory_views",
    "default_regulatory_id",
    "group_dimensions",
    "default_dimension_id",
    "cross_group_insights",
    "top20_distributors",
    "data_availability",
}

LEGACY_NEO_KEYS = {
    "neo_anual",
    "neo_tendencia",
    "neo_benchmark",
    "neo_classe_local",
    "neo_longa_resumo",
    "neo_mensal",
}

REQUIRED_INPUTS = [
    ANALYSIS_DIR / "kpi_regulatorio_anual.csv",
    ANALYSIS_DIR / "fato_transgressao_mensal_distribuidora.csv",
    ANALYSIS_DIR / "fato_transgressao_mensal_porte.csv",
    ANALYSIS_DIR / "fato_indicadores_anuais.csv",
    ANALYSIS_DIR / "dim_distributor_group.csv",
    ANALYSIS_DIR / "dim_distribuidora_porte.csv",
    GROUPS_DIR / "grupos_anual_2023_2025.csv",
    GROUPS_DIR / "grupos_tendencia_2023_2025.csv",
    GROUPS_DIR / "grupos_benchmark_porte_latest.csv",
    GROUPS_DIR / "grupos_classe_local_2023_2025.csv",
    GROUPS_DIR / "grupos_longa_resumo_2011_2023.csv",
    GROUPS_DIR / "grupos_mensal_2023_2025.csv",
    ANALYSIS_DIR / "fato_grupos_algoritmicos.csv",
]


def _load_dashboard_payload() -> dict[str, Any]:
    if not DASHBOARD_JSON_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="dashboard_data.json not found. Run `make dashboard` first.",
        )

    try:
        payload = json.loads(DASHBOARD_JSON_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid dashboard JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail="Invalid dashboard payload format.")

    missing = sorted(REQUIRED_JSON_KEYS - set(payload.keys()))
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Dashboard JSON missing keys: {', '.join(missing)}",
        )
    group_views = payload.get("group_views", {})
    if isinstance(group_views, dict) and "neoenergia" in group_views:
        missing_legacy = sorted(LEGACY_NEO_KEYS - set(payload.keys()))
        if missing_legacy:
            raise HTTPException(
                status_code=500,
                detail=f"Dashboard JSON missing legacy keys for neoenergia: {', '.join(missing_legacy)}",
            )

    return payload


def _artifact_status() -> dict[str, Any]:
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED_INPUTS if not path.exists()]

    stale_inputs: list[str] = []
    dashboard_mtime: str | None = None

    if DASHBOARD_JSON_PATH.exists():
        dashboard_ts = DASHBOARD_JSON_PATH.stat().st_mtime
        dashboard_mtime = datetime.fromtimestamp(dashboard_ts, tz=timezone.utc).isoformat()

        for path in REQUIRED_INPUTS:
            if path.exists() and path.stat().st_mtime > dashboard_ts:
                stale_inputs.append(str(path.relative_to(ROOT)))

    return {
        "missing_artifacts": missing,
        "stale_inputs": stale_inputs,
        "dashboard_generated_at_utc": dashboard_mtime,
    }


app = FastAPI(
    title="TCC REN1000 Local Backend",
    description="Local API and static serving for ANEEL analysis dashboard.",
    version="1.0.0",
)

_CORS_ORIGINS_PROD = [
    "https://analise-ren-1000-a-iv-setor-eletric.vercel.app",
    "https://tcc-ren1000x414-production.up.railway.app",
]
_allowed_origins = (
    ["*"] if os.getenv("ENV", "local") == "local"
    else _CORS_ORIGINS_PROD
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Content-Type", "Accept"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    status = _artifact_status()
    ok = not status["missing_artifacts"]
    return {
        "status": "ok" if ok else "degraded",
        "service": "tcc-local-backend",
        **status,
    }


@app.get("/api/dashboard")
def api_dashboard() -> dict[str, Any]:
    return _load_dashboard_payload()


_VALID_SECTIONS = frozenset(REQUIRED_JSON_KEYS | LEGACY_NEO_KEYS | {"franquias_insights"})


@app.get("/api/dashboard/{section}")
def api_dashboard_section(section: str) -> dict[str, Any]:
    if section not in _VALID_SECTIONS:
        raise HTTPException(status_code=404, detail="Section not found.")
    payload = _load_dashboard_payload()
    if section not in payload:
        raise HTTPException(status_code=404, detail="Section not found.")
    return {
        "meta": payload.get("meta", {}),
        "section": section,
        "data": payload[section],
    }


@app.get("/api/artifacts")
def api_artifacts() -> dict[str, Any]:
    return _artifact_status()


@app.get("/api/v1/heatmap-transgressoes")
def api_heatmap_transgressoes() -> dict[str, Any]:
    payload = _load_dashboard_payload()
    return {"data": payload.get("franquias_insights", {}).get("heatmap_transgressoes", [])}

@app.get("/api/v1/scatter-eficiencia")
def api_scatter_eficiencia() -> dict[str, Any]:
    payload = _load_dashboard_payload()
    return {"data": payload.get("franquias_insights", {}).get("scatter_eficiencia", [])}

@app.get("/api/v1/radar-slas")
def api_radar_slas() -> dict[str, Any]:
    payload = _load_dashboard_payload()
    return payload.get("franquias_insights", {}).get("radar_slas", {"services": [], "data": []})

@app.get("/api/v1/timeseries-tendencia")
def api_timeseries_tendencia() -> dict[str, Any]:
    payload = _load_dashboard_payload()
    return {"data": payload.get("franquias_insights", {}).get("timeseries_tendencia", [])}





if os.getenv("SERVE_STATIC", "true").lower() != "false":
    app.mount("/", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard")
