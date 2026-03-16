"""Testes de integração para os endpoints FastAPI em app/backend/main.py.

Usa TestClient do Starlette (via httpx) para exercitar todas as rotas sem
precisar de servidor externo. Os testes mockam o arquivo dashboard_data.json
para não depender de dados gerados pelo pipeline.

Cobertura:
- GET /health → 200 com campos obrigatórios
- GET /api/dashboard → 200 com payload completo / 503 sem JSON
- GET /api/dashboard/{section} → 200 seção existente / 404 seção ausente
- GET /api/artifacts → 200 com campos de status
- GET /api/v1/* → 200 com campo "data"
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

# Importação condicional: testes são ignorados se fastapi/httpx não instalados
pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MINIMAL_REQUIRED_KEYS = {
    "meta", "kpi_overview", "serie_anual", "serie_mensal_nacional",
    "distributor_groups", "group_views", "default_group_id",
    "featured_group_ids", "featured_groups", "featured_group_compare_anual",
    "featured_group_compare_latest", "regulatory_groups", "regulatory_views",
    "default_regulatory_id", "group_dimensions", "default_dimension_id",
    "cross_group_insights", "top20_distributors", "data_availability",
}


def _make_payload(**overrides) -> dict[str, Any]:
    """Cria payload mínimo válido que passa a validação do backend."""
    base = {key: {} for key in MINIMAL_REQUIRED_KEYS}
    base.update({
        "serie_anual": [{"ano": 2023, "value": 1}],
        "serie_mensal_nacional": [{"mes": 1}],
        "distributor_groups": [{"group_id": "neoenergia"}],
        "group_views": {},          # sem "neoenergia" → sem legacy key check
        "featured_group_ids": ["neoenergia"],
        "featured_groups": [{"group_id": "neoenergia"}],
        "featured_group_compare_anual": [],
        "featured_group_compare_latest": [],
        "regulatory_groups": [{"id": "grupo_a"}],
        "regulatory_views": {"grupo_a": {}},
        "top20_distributors": [{"rank": 1}],
        "group_dimensions": [{"id": "economico"}],
        "cross_group_insights": [{"id": "x"}],
        "meta": {"generated_at": "2024-01-01"},
        "franquias_insights": {"heatmap_transgressoes": [], "scatter_eficiencia": [],
                                "radar_slas": {"services": [], "data": []},
                                "timeseries_tendencia": []},
    })
    base.update(overrides)
    return base


@pytest.fixture()
def dashboard_json_file(tmp_path):
    """Cria arquivo temporário dashboard_data.json com payload mínimo válido."""
    path = tmp_path / "dashboard_data.json"
    path.write_text(json.dumps(_make_payload()), encoding="utf-8")
    return path


@pytest.fixture()
def client(dashboard_json_file, tmp_path):
    """TestClient com DASHBOARD_JSON_PATH apontando para arquivo temporário.

    Desativa static file serving para evitar erros de diretório não encontrado.
    """
    # Patch de variáveis do módulo ANTES de importar o app
    with patch.dict(os.environ, {"SERVE_STATIC": "false"}):
        import importlib
        import app.backend.main as backend_module

        original_path = backend_module.DASHBOARD_JSON_PATH
        original_inputs = backend_module.REQUIRED_INPUTS

        backend_module.DASHBOARD_JSON_PATH = dashboard_json_file
        backend_module.REQUIRED_INPUTS = []  # sem artefatos obrigatórios para health

        try:
            # Re-importa para garantir app fresh (sem static mount)
            yield TestClient(backend_module.app)
        finally:
            backend_module.DASHBOARD_JSON_PATH = original_path
            backend_module.REQUIRED_INPUTS = original_inputs


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

class TestHealthEndpoint:
    def test_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_has_status_field(self, client):
        data = client.get("/health").json()
        assert "status" in data

    def test_has_missing_artifacts_field(self, client):
        data = client.get("/health").json()
        assert "missing_artifacts" in data

    def test_status_ok_when_no_missing_artifacts(self, client):
        data = client.get("/health").json()
        # REQUIRED_INPUTS é [] no fixture → sem artefatos faltando
        assert data["status"] == "ok"


# ---------------------------------------------------------------------------
# GET /api/dashboard
# ---------------------------------------------------------------------------

class TestApiDashboard:
    def test_returns_200_with_valid_json(self, client):
        response = client.get("/api/dashboard")
        assert response.status_code == 200

    def test_response_contains_required_keys(self, client):
        data = client.get("/api/dashboard").json()
        for key in ("meta", "serie_anual", "distributor_groups"):
            assert key in data, f"Chave '{key}' ausente no payload"

    def test_returns_503_when_json_missing(self, tmp_path):
        with patch.dict(os.environ, {"SERVE_STATIC": "false"}):
            import app.backend.main as backend_module
            original = backend_module.DASHBOARD_JSON_PATH
            backend_module.DASHBOARD_JSON_PATH = tmp_path / "nao_existe.json"
            try:
                c = TestClient(backend_module.app, raise_server_exceptions=False)
                response = c.get("/api/dashboard")
                assert response.status_code == 503
            finally:
                backend_module.DASHBOARD_JSON_PATH = original


# ---------------------------------------------------------------------------
# GET /api/dashboard/{section}
# ---------------------------------------------------------------------------

class TestApiDashboardSection:
    def test_existing_section_returns_200(self, client):
        response = client.get("/api/dashboard/meta")
        assert response.status_code == 200

    def test_existing_section_has_data_field(self, client):
        data = client.get("/api/dashboard/serie_anual").json()
        assert "data" in data
        assert "section" in data

    def test_nonexistent_section_returns_404(self, client):
        response = client.get("/api/dashboard/secao_que_nao_existe")
        assert response.status_code == 404

    def test_section_response_includes_meta(self, client):
        data = client.get("/api/dashboard/distributor_groups").json()
        assert "meta" in data


# ---------------------------------------------------------------------------
# GET /api/artifacts
# ---------------------------------------------------------------------------

class TestApiArtifacts:
    def test_returns_200(self, client):
        assert client.get("/api/artifacts").status_code == 200

    def test_has_missing_artifacts(self, client):
        data = client.get("/api/artifacts").json()
        assert "missing_artifacts" in data

    def test_has_stale_inputs(self, client):
        data = client.get("/api/artifacts").json()
        assert "stale_inputs" in data


# ---------------------------------------------------------------------------
# GET /api/v1/* endpoints
# ---------------------------------------------------------------------------

class TestApiV1Endpoints:
    @pytest.mark.parametrize("path", [
        "/api/v1/heatmap-transgressoes",
        "/api/v1/scatter-eficiencia",
        "/api/v1/timeseries-tendencia",
    ])
    def test_returns_200(self, client, path):
        response = client.get(path)
        assert response.status_code == 200

    @pytest.mark.parametrize("path", [
        "/api/v1/heatmap-transgressoes",
        "/api/v1/scatter-eficiencia",
        "/api/v1/timeseries-tendencia",
    ])
    def test_has_data_field(self, client, path):
        data = client.get(path).json()
        assert "data" in data

    def test_radar_slas_returns_200(self, client):
        assert client.get("/api/v1/radar-slas").status_code == 200

    def test_radar_slas_has_services_and_data(self, client):
        data = client.get("/api/v1/radar-slas").json()
        assert "services" in data
        assert "data" in data
