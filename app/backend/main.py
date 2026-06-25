"""FastAPI backend for local dashboard and data endpoints."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.backend.core.database import db_manager
from app.backend.core.postgres_dashboard import (
    PostgresDashboardUnavailable,
    fetch_timeseries_tendencia,
    table_status,
)

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent.parent
APP_DIR = ROOT / "app"
DASHBOARD_DATA_DIR = ROOT / "data" / "processed" / "dashboard"
DASHBOARD_JSON_PATH = DASHBOARD_DATA_DIR / "dashboard_data.json"
ANALYSIS_DIR = ROOT / "data" / "processed" / "analysis"
GROUPS_DIR = ANALYSIS_DIR / "grupos"
CHART_JSON_FILES = {
    "timeseries_tendencia": "dashboard_timeseries.json",
    "scatter_eficiencia": "dashboard_scatter.json",
    "heatmap_transgressoes": "dashboard_heatmap.json",
    "radar_slas": "dashboard_radar.json",
    "groups_ranking": "dashboard_groups_ranking.json",
    "transgressoes": "dashboard_transgressoes.json",
}
DASHBOARD_PUBLIC_JSON_FILES = frozenset({"dashboard_data.json", *CHART_JSON_FILES.values()})

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
    GROUPS_DIR / "grupos_anual_2023_plus.csv",
    GROUPS_DIR / "grupos_tendencia_2023_plus.csv",
    GROUPS_DIR / "grupos_benchmark_porte_latest.csv",
    GROUPS_DIR / "grupos_classe_local_2023_plus.csv",
    GROUPS_DIR / "grupos_longa_resumo_2011_2023.csv",
    GROUPS_DIR / "grupos_mensal_2023_plus.csv",
    ANALYSIS_DIR / "fato_grupos_algoritmicos.csv",
]


def _load_dashboard_payload() -> dict[str, Any]:
    if not DASHBOARD_JSON_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="dashboard_data.json not found. Run `make pipeline` for scientific reproduction or `make dashboard-full` if analysis tables already exist.",
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


def _load_chart_payload(key: str) -> dict[str, Any]:
    file_name = CHART_JSON_FILES.get(key)
    if not file_name:
        raise HTTPException(status_code=404, detail="Chart data source not found.")

    path = DASHBOARD_DATA_DIR / file_name
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"{file_name} not found. Run `make dashboard-full` first.",
        )

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in {file_name}: {exc}") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail=f"Invalid payload format in {file_name}.")

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db_manager.connect()
    yield
    # Shutdown
    await db_manager.disconnect()

app = FastAPI(
    title="TCC REN1000 Local Backend",
    description="Local API and static serving for ANEEL analysis dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

_CORS_ORIGINS_PROD = [
    "https://analise-ren-1000-a-iv-setor-eletric.vercel.app",
    "https://tcc-frontend-react.vercel.app",
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
async def health() -> dict[str, Any]:
    status = _artifact_status()
    dashboard_artifacts_ready = not status["missing_artifacts"]
    db_ok = False
    redis_ok = False
    
    if db_manager.pool:
        try:
            async with db_manager.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            db_ok = True
        except Exception:
            pass
            
    if db_manager.redis:
        try:
            await db_manager.redis.ping()
            redis_ok = True
        except Exception:
            pass
            
    ok = dashboard_artifacts_ready and db_ok and redis_ok
    return {
        "status": "ok" if ok else "degraded",
        "service": "tcc-local-backend",
        "dashboard_artifacts_ready": dashboard_artifacts_ready,
        "database_connected": db_ok,
        "redis_connected": redis_ok,
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


@app.get("/api/v1/timeseries-tendencia")
def api_timeseries_tendencia() -> dict[str, Any]:
    return _load_chart_payload("timeseries_tendencia")


@app.get("/api/v1/scatter-eficiencia")
def api_scatter_eficiencia() -> dict[str, Any]:
    return _load_chart_payload("scatter_eficiencia")


@app.get("/api/v1/heatmap-transgressoes")
def api_heatmap_transgressoes() -> dict[str, Any]:
    return _load_chart_payload("heatmap_transgressoes")


@app.get("/api/v1/radar-slas")
def api_radar_slas() -> dict[str, Any]:
    return _load_chart_payload("radar_slas")


@app.get("/api/v1/groups-ranking")
def api_groups_ranking() -> dict[str, Any]:
    return _load_chart_payload("groups_ranking")


@app.get("/api/v1/transgressoes")
def api_transgressoes() -> dict[str, Any]:
    return _load_chart_payload("transgressoes")


async def _postgres_timeseries_or_json(
    *, group_id: str | None = None, start: str | None = None, end: str | None = None
) -> dict[str, Any]:
    if db_manager.pool:
        try:
            payload = await fetch_timeseries_tendencia(
                db_manager.pool, group_id=group_id, start=start, end=end
            )
            return {"source": "postgres", **payload}
        except (PostgresDashboardUnavailable, ValueError):
            pass
        except Exception:
            # Postgres is optional: keep the public dashboard functional via JSON.
            pass

    payload = _load_chart_payload("timeseries_tendencia")
    return {"source": "json", **payload}


@app.get("/api/v2/db-status")
async def api_v2_db_status() -> dict[str, Any]:
    if not db_manager.pool:
        return {
            "available": False,
            "tables_ready": False,
            "present_tables": [],
            "missing_tables": [],
            "row_counts": {},
        }
    try:
        return await table_status(db_manager.pool)
    except Exception as exc:
        return {
            "available": False,
            "tables_ready": False,
            "present_tables": [],
            "missing_tables": [],
            "row_counts": {},
            "error": type(exc).__name__,
        }


@app.get("/api/v2/timeseries-tendencia")
async def api_v2_timeseries_tendencia(
    group_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, Any]:
    return await _postgres_timeseries_or_json(group_id=group_id, start=start, end=end)


def _dashboard_json_response(file_name: str) -> FileResponse:
    if file_name not in DASHBOARD_PUBLIC_JSON_FILES:
        raise HTTPException(status_code=404, detail="Dashboard JSON not found.")

    path = DASHBOARD_DATA_DIR / file_name
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"{file_name} not found. Run `make dashboard-full` first.",
        )

    return FileResponse(path, media_type="application/json")


def _dashboard_json_endpoint(file_name: str):
    def endpoint() -> FileResponse:
        return _dashboard_json_response(file_name)

    endpoint.__name__ = f"dashboard_json_{file_name.removesuffix('.json')}"
    return endpoint


for _dashboard_file_name in sorted(DASHBOARD_PUBLIC_JSON_FILES):
    app.add_api_route(
        f"/{_dashboard_file_name}",
        _dashboard_json_endpoint(_dashboard_file_name),
        methods=["GET"],
        include_in_schema=False,
    )
