"""Regression checks for optional PostgreSQL-backed dashboard paths."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.backend import main as backend_main
from app.backend.core import postgres_dashboard
from scripts import load_to_postgres


class _FakeAcquire:
    def __init__(self, conn: "_FakeConnection") -> None:
        self.conn = conn

    async def __aenter__(self) -> "_FakeConnection":
        return self.conn

    async def __aexit__(self, *_args: object) -> None:
        return None


class _FakePool:
    def __init__(self) -> None:
        self.conn = _FakeConnection()

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self.conn)


class _FakeConnection:
    async def fetchval(self, _query: str, table_name: str) -> bool:
        return table_name == postgres_dashboard.HOME_SERVICE_TYPES_TABLE

    async def fetch(self, _query: str, *_args: object) -> list[dict]:
        return [
            {
                "ano": 2023,
                "group_id": "grupo_teste",
                "distributor_id": "dist_teste",
                "classe_local_servico": "grupo_a",
                "qtd_serv_realizado": 0,
                "qtd_fora_prazo": 0,
                "compensacao_rs": 0,
                "uc_ativa_mes": 0,
                "meses_observados": 1,
            },
            {
                "ano": 2023,
                "group_id": "grupo_teste",
                "distributor_id": "dist_teste",
                "classe_local_servico": "rural",
                "qtd_serv_realizado": 10,
                "qtd_fora_prazo": 2,
                "compensacao_rs": 100.5,
                "uc_ativa_mes": 1234,
                "meses_observados": 1,
            },
        ]


def test_v2_timeseries_falls_back_to_json_without_postgres() -> None:
    """The Postgres path must be additive: JSON remains available if DB is down."""

    async def run() -> dict:
        original_pool = backend_main.db_manager.pool
        backend_main.db_manager.pool = None
        try:
            return await backend_main.api_v2_timeseries_tendencia()
        finally:
            backend_main.db_manager.pool = original_pool

    payload = asyncio.run(run())

    assert payload["source"] == "json"
    assert isinstance(payload["data"], list)
    assert payload["data"], "fallback should return the canonical dashboard_timeseries.json data"


def test_home_service_types_fetch_preserves_zero_class_rows_from_postgres() -> None:
    """Home lower charts must use exact class/locality rows, including real zeros."""

    payload = asyncio.run(postgres_dashboard.fetch_home_service_types(_FakePool()))

    assert payload["data"][0] == {
        "ano": 2023,
        "group_id": "grupo_teste",
        "distributor_id": "dist_teste",
        "classe_local_servico": "grupo_a",
        "qtd_serv_realizado": 0.0,
        "qtd_fora_prazo": 0.0,
        "compensacao_rs": 0.0,
        "uc_ativa_mes": 0.0,
        "meses_observados": 1,
    }
    assert payload["data"][1]["classe_local_servico"] == "rural"
    assert payload["data"][1]["compensacao_rs"] == 100.5


def test_v2_home_service_types_falls_back_to_exact_csv_without_postgres() -> None:
    """The Home endpoint should stay exact even when PostgreSQL is unavailable locally."""

    async def run() -> dict:
        original_pool = backend_main.db_manager.pool
        backend_main.db_manager.pool = None
        try:
            return await backend_main.api_v2_home_service_types()
        finally:
            backend_main.db_manager.pool = original_pool

    payload = asyncio.run(run())

    assert payload["source"] == "csv"
    assert isinstance(payload["data"], list)
    assert payload["data"], "fallback should be built from fato_transgressao_mensal_porte.csv"
    assert {"ano", "group_id", "distributor_id", "classe_local_servico"}.issubset(payload["data"][0])


def test_postgres_loader_discovers_versioned_analysis_csvs(tmp_path: Path) -> None:
    """Replicators should be able to load the versioned analysis CSVs, not only local Parquets."""
    analysis_dir = tmp_path / "data" / "processed" / "analysis"
    groups_dir = analysis_dir / "grupos"
    groups_dir.mkdir(parents=True, exist_ok=True)

    root_csv = analysis_dir / "fato_transgressao_mensal_distribuidora.csv"
    nested_csv = groups_dir / "grupos_mensal_2023_plus.csv"
    root_csv.write_text("ano,mes\n2023,1\n", encoding="utf-8")
    nested_csv.write_text("ano,mes\n2023,1\n", encoding="utf-8")

    sources = load_to_postgres.discover_data_sources(tmp_path)
    discovered = {source.path.relative_to(tmp_path).as_posix() for source in sources}

    assert "data/processed/analysis/fato_transgressao_mensal_distribuidora.csv" in discovered
    assert "data/processed/analysis/grupos/grupos_mensal_2023_plus.csv" in discovered


def test_postgres_loader_builds_core_indexes_for_filtering() -> None:
    statements = load_to_postgres.build_index_statements(
        {"fato_transgressao_mensal_distribuidora", "fato_servicos_classe_mes"}
    )

    joined = "\n".join(statements)
    assert "idx_fato_transgressao_mensal_distribuidora_ano_mes" in joined
    assert "idx_fato_transgressao_mensal_distribuidora_group" in joined
    assert "idx_fato_servicos_classe_mes_classe" in joined


def test_postgres_loader_can_filter_sources_for_quick_smoke(tmp_path: Path) -> None:
    analysis_dir = tmp_path / "data" / "processed" / "analysis"
    groups_dir = analysis_dir / "grupos"
    groups_dir.mkdir(parents=True, exist_ok=True)
    (analysis_dir / "fato_transgressao_mensal_distribuidora.csv").write_text(
        "ano,mes\n2023,1\n", encoding="utf-8"
    )
    (groups_dir / "grupos_mensal_2023_plus.csv").write_text(
        "ano,mes\n2023,1\n", encoding="utf-8"
    )

    sources = load_to_postgres.discover_data_sources(tmp_path)
    filtered = load_to_postgres.filter_sources(sources, {"grupos_mensal_2023_plus"})

    assert [source.table_name for source in filtered] == ["grupos_mensal_2023_plus"]


def main() -> None:
    test_v2_timeseries_falls_back_to_json_without_postgres()
    test_home_service_types_fetch_preserves_zero_class_rows_from_postgres()
    test_v2_home_service_types_falls_back_to_exact_csv_without_postgres()
    test_postgres_loader_discovers_versioned_analysis_csvs(Path("/tmp/postgres-loader-test"))
    test_postgres_loader_builds_core_indexes_for_filtering()
    test_postgres_loader_can_filter_sources_for_quick_smoke(Path("/tmp/postgres-loader-filter-test"))
    print("Postgres dashboard contract tests OK.")


if __name__ == "__main__":
    main()
